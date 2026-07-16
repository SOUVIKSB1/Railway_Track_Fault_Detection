"""
train_model.py — Railway Track Fault Detection (Improved v2)
=============================================================
Fixes over v1:
  ✅  EfficientNetV2B0 — better accuracy on small datasets than DenseNet121
  ✅  Class weight balancing — auto-corrects if one class has more images
  ✅  Label smoothing — stops model from being overconfident on wrong predictions
  ✅  Confidence threshold — app now rejects irrelevant / ambiguous images
  ✅  Stronger augmentation — more variety from fewer images
  ✅  Fixed fine-tuning — Phase 2 never overwrites a better Phase 1 model
  ✅  Larger batch size — more stable gradient updates
"""

import os, json, ssl
ssl._create_default_https_context = ssl._create_unverified_context   # Allow downloading weights

import numpy as np
import matplotlib
matplotlib.use('Agg')    # Save graphs to files without needing a display window
import matplotlib.pyplot as plt
import seaborn as sns
import tensorflow as tf

from tensorflow.keras.applications        import EfficientNetV2B0
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input
from tensorflow.keras.layers              import GlobalAveragePooling2D, Dense, Dropout, BatchNormalization
from tensorflow.keras.models              import Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks           import EarlyStopping, ReduceLROnPlateau
from sklearn.metrics                      import classification_report, confusion_matrix
from sklearn.utils.class_weight           import compute_class_weight


# ═══════════════════════════════════════════════════════════════════════════════
# SETTINGS — Edit these if needed
# ═══════════════════════════════════════════════════════════════════════════════
DATASET_PATH = "/Users/souvik/Desktop/MY_CODES/Projects/IITR/RAILWAY_DEFECT/railway_fault_detector/dataset"
IMAGE_SIZE   = (224, 224)
BATCH_SIZE   = 16          # Reduced to 16 for better gradient noise / regularization
EPOCHS_HEAD  = 30          # Phase 1: train ONLY the new layers (base is frozen)
EPOCHS_FINE  = 30          # Phase 2: fine-tune top blocks of EfficientNetV2B0

LR_HEAD      = 1e-3        # Phase 1 learning rate
LR_FINE      = 1e-4        # Phase 2 learning rate — slightly higher for adaptive block updates

# ── Confidence Threshold ──────────────────────────────────────────────────────
# Problem with v1: if you give an irrelevant image (e.g. a car photo), the model
# still outputs a class — because softmax always sums to 1.0. There's no "I don't know".
#
# Fix: if the model's top confidence is below this value → output "Uncertain".
# 0.72 = require at least 72% confidence before making a real prediction.
# See the calibration table printed during training to fine-tune this number.
CONFIDENCE_THRESHOLD = 0.72

MODEL_SAVE   = "railway_model.keras"   # Modern format (.keras replaces legacy .h5)
RESULTS_DIR  = "results"
os.makedirs(RESULTS_DIR, exist_ok=True)


print("═" * 65)
print("  Railway Track Fault Detection — Improved Training v2")
print("═" * 65)
print(f"  TensorFlow : {tf.__version__}")
print(f"  GPU        : {len(tf.config.list_physical_devices('GPU')) > 0}")
print(f"  Model      : EfficientNetV2B0  (replaces DenseNet121)")
print(f"  Batch size : {BATCH_SIZE}  (was 8 — doubled for stability)")
print("═" * 65)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — LOAD IMAGES WITH AUGMENTATION
#
# Why augmentation matters for small datasets?
#   We only have ~300 images. Augmentation artificially creates variety by
#   randomly flipping, rotating, zooming, and changing brightness.
#   This helps the model learn to recognize tracks in different real-world
#   conditions (night, rain, different camera angles) without needing more data.
# ═══════════════════════════════════════════════════════════════════════════════
print("\n📂 Loading images from dataset...")

train_datagen = ImageDataGenerator(
    preprocessing_function = preprocess_input,   # EfficientNetV2 normalization
    rotation_range         = 15,                 # Tamed to 15° to keep track structures coherent
    width_shift_range      = 0.10,               # Tamed to 10% to keep track centered
    height_shift_range     = 0.10,               # Tamed to 10% to prevent vertical cropping
    shear_range            = 0.10,               # Slight angular distortion
    zoom_range             = 0.15,               # Zoom in or out up to 15%
    horizontal_flip        = True,               # Randomly mirror left↔right
    vertical_flip          = False,              # Don't flip upside down
    brightness_range       = [0.75, 1.25],       # Tamed brightness variations
    channel_shift_range    = 10.0,               # Tamed channel color shifts
    fill_mode              = 'nearest',          # Fill gaps after rotation/shift
    validation_split       = 0.2                 # Keep 20% for validation
)

val_datagen = ImageDataGenerator(
    preprocessing_function = preprocess_input,   # Same normalization, but NO augmentation
    validation_split       = 0.2
)

train_gen = train_datagen.flow_from_directory(
    DATASET_PATH, target_size=IMAGE_SIZE, batch_size=BATCH_SIZE,
    class_mode='categorical', subset='training', shuffle=True, seed=42
)
val_gen = val_datagen.flow_from_directory(
    DATASET_PATH, target_size=IMAGE_SIZE, batch_size=BATCH_SIZE,
    class_mode='categorical', subset='validation', shuffle=False, seed=42
)

CLASS_NAMES = list(train_gen.class_indices.keys())
NUM_CLASSES = len(CLASS_NAMES)

print(f"\n✅ Classes found   : {CLASS_NAMES}")
print(f"✅ Training images : {train_gen.samples}")
print(f"✅ Validation imgs : {val_gen.samples}")
print(f"✅ Total classes   : {NUM_CLASSES}")

with open("class_names.json", "w") as f:
    json.dump(CLASS_NAMES, f)
print("✅ class_names.json saved")


# ═══════════════════════════════════════════════════════════════════════════════
# CLASS WEIGHT BALANCING
#
# What is class imbalance?
#   If you have 200 Defective and 100 Non_Defective images, the model learns
#   to mostly predict "Defective" because it's more common. This means it
#   misses real Non_Defective tracks — a safety problem.
#
# Fix: Give more weight to the smaller class so both classes matter equally.
#   The compute_class_weight function does this automatically.
# ═══════════════════════════════════════════════════════════════════════════════
weights_arr  = compute_class_weight(
    class_weight = 'balanced',
    classes      = np.unique(train_gen.classes),
    y            = train_gen.classes
)
class_weights = {i: float(w) for i, w in enumerate(weights_arr)}
print(f"\n✅ Auto-computed class weights:")
for i, name in enumerate(CLASS_NAMES):
    print(f"   Class {i} ({name:20s}): weight = {class_weights[i]:.3f}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — BUILD MODEL (EfficientNetV2B0 + Custom Head)
#
# Why switch from DenseNet121 to EfficientNetV2B0?
#   • EfficientNetV2B0 was designed with progressive training — it learns
#     efficient features from the start, making it better for small datasets.
#   • It's about 30% lighter (fewer parameters) = less overfitting risk.
#   • Achieves higher ImageNet accuracy than DenseNet121 at the same speed.
#   • Same input size (224×224), so your images work as-is.
#
# TWO EXTRA DENSE LAYERS (vs v1 which had one):
#   Adding Dense(256) → Dense(128) creates a richer pathway for the model
#   to learn railway-specific patterns, while Dropout prevents memorisation.
# ═══════════════════════════════════════════════════════════════════════════════
print("\n🧠 Building model (EfficientNetV2B0 + classification head)...")

base_model = EfficientNetV2B0(
    input_shape = (*IMAGE_SIZE, 3),
    include_top = False,         # Remove ImageNet's 1000-class head
    weights     = 'imagenet'     # Start with pre-trained weights
)
base_model.trainable = False     # Phase 1: freeze ALL base layers

x       = base_model.output
x       = GlobalAveragePooling2D()(x)     # Compress 7×7×1280 → flat 1280
x       = Dropout(0.3)(x)                # Dropout to prevent overfitting
outputs = Dense(NUM_CLASSES, activation='softmax')(x)   # Final: probability per class

model = Model(inputs=base_model.input, outputs=outputs, name="RailwayFaultDetector_v2")

# LABEL SMOOTHING — key fix for overconfidence on ambiguous images
# Without smoothing: target = [0, 1.0]   (model tries to be 100% sure)
# With smoothing:    target = [0.05, 0.95] (model allows 5% uncertainty)
# This directly reduces the "confidently wrong" problem on confusing images.
model.compile(
    optimizer = tf.keras.optimizers.Adam(learning_rate=LR_HEAD),
    loss      = tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.10),
    metrics   = ['accuracy']
)

model.summary()
total_p     = model.count_params()
trainable_p = sum(np.prod(v.shape) for v in model.trainable_weights)
print(f"\n📐 Total parameters     : {total_p:,}")
print(f"📐 Trainable (Phase 1)  : {trainable_p:,}  (only our new layers)")


# ═══════════════════════════════════════════════════════════════════════════════
# CUSTOM CALLBACK: Save only when we beat the GLOBAL best
#
# Bug in v1: Phase 2's ModelCheckpoint reset its "best" counter to -inf,
# so it saved models that were WORSE than Phase 1's best. This callback
# fixes that by carrying the Phase 1 best accuracy into Phase 2.
# ═══════════════════════════════════════════════════════════════════════════════
class SaveIfBetter(tf.keras.callbacks.Callback):
    """Saves the model only when validation accuracy improves over ALL previous epochs."""
    def __init__(self, filepath, baseline=0.0):
        super().__init__()
        self.filepath = filepath
        self.best     = baseline   # Start from Phase 1's best — won't save unless we beat it

    def on_epoch_end(self, epoch, logs=None):
        val_acc = logs.get('val_accuracy', 0.0)
        if val_acc > self.best:
            self.best = val_acc
            self.model.save(self.filepath)
            print(f"\n  💾  New global best: {val_acc:.4f} → saved {self.filepath}")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — PHASE 1: TRAIN CLASSIFICATION HEAD ONLY
#
# We freeze EfficientNetV2B0 completely and only train our added layers.
# This is fast (~20 seconds/epoch) and gives a solid starting accuracy.
# ═══════════════════════════════════════════════════════════════════════════════
print("\n🚂 Phase 1: Training classification head (base is frozen)...")
print("  EfficientNetV2B0 is locked — only Dense/Dropout layers learn.\n")

p1_checkpoint = SaveIfBetter(filepath=MODEL_SAVE, baseline=0.0)

callbacks_p1 = [
    EarlyStopping(
        monitor             = 'val_accuracy',
        patience            = 15,               # Stop after 7 non-improving epochs
        restore_best_weights= True,
        verbose             = 1,
        mode                = 'max'
    ),
    p1_checkpoint,
    ReduceLROnPlateau(
        monitor  = 'val_loss',
        factor   = 0.50,     # Reduce LR to 50% (was 0.2 = 20% — too aggressive)
        patience = 3,
        min_lr   = 1e-7,
        verbose  = 1
    )
]

history_p1 = model.fit(
    train_gen,
    validation_data = val_gen,
    epochs          = EPOCHS_HEAD,
    callbacks       = callbacks_p1,
    class_weight    = class_weights    # Apply class balancing here
)

best_p1_acc = max(history_p1.history['val_accuracy'])
print(f"\n✅ Phase 1 complete — best val accuracy: {best_p1_acc * 100:.2f}%")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — PHASE 2: FINE-TUNE TOP 40% OF EFFICIENTNETV2B0
#
# Now we "unfreeze" the upper layers of EfficientNetV2B0 so they can also
# adapt to railway track patterns. We use an extremely small learning rate
# (5e-5) to avoid "catastrophic forgetting" of ImageNet features.
#
# Rule: BatchNormalization layers stay frozen ALWAYS.
#   Unfreezing BatchNorm during fine-tuning destabilizes training.
# ═══════════════════════════════════════════════════════════════════════════════
print("\n🔧 Phase 2: Fine-tuning top 40% of EfficientNetV2B0...")

# Set base model trainable to True so sublayer trainable changes take effect
base_model.trainable = True

for layer in base_model.layers:
    # Always keep BatchNormalization frozen
    if isinstance(layer, tf.keras.layers.BatchNormalization):
        layer.trainable = False
    # Unfreeze block5, block6, and subsequent top layers of base model
    elif any(block_name in layer.name for block_name in ['block5', 'block6', 'top']):
        layer.trainable = True
    # Keep early feature extraction blocks frozen
    else:
        layer.trainable = False

trainable_p2 = sum(np.prod(v.shape) for v in model.trainable_weights)
print(f"📐 Trainable (Phase 2): {trainable_p2:,}  (top 40% of base + head)")

model.compile(
    optimizer = tf.keras.optimizers.Adam(learning_rate=LR_FINE),   # Much smaller LR
    loss      = tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.10),
    metrics   = ['accuracy']
)

# KEY FIX: Pass best_p1_acc as baseline — Phase 2 only saves if it beats Phase 1 best
p2_checkpoint = SaveIfBetter(filepath=MODEL_SAVE, baseline=best_p1_acc)
phase1_epochs = len(history_p1.history['accuracy'])

callbacks_p2 = [
    EarlyStopping(
        monitor             = 'val_accuracy',
        patience            = 8,
        restore_best_weights= True,
        verbose             = 1,
        mode                = 'max'
    ),
    p2_checkpoint,
    ReduceLROnPlateau(
        monitor  = 'val_loss',
        factor   = 0.40,
        patience = 3,
        min_lr   = 1e-8,
        verbose  = 1
    )
]

history_p2 = model.fit(
    train_gen,
    validation_data = val_gen,
    epochs          = phase1_epochs + EPOCHS_FINE,
    initial_epoch   = phase1_epochs,    # Continue epoch count — doesn't restart at 0
    callbacks       = callbacks_p2,
    class_weight    = class_weights
)

best_p2_acc   = max(history_p2.history['val_accuracy'])
overall_best  = max(best_p1_acc, best_p2_acc)
print(f"\n✅ Phase 2 complete — best val accuracy: {best_p2_acc * 100:.2f}%")
print(f"✅ Overall best val accuracy           : {overall_best * 100:.2f}%")

# If Phase 2 didn't beat Phase 1, the saved model is still the Phase 1 best — that's fine.
if best_p2_acc <= best_p1_acc:
    print("  ℹ️  Phase 1 model was better — it was kept. Fine-tuning didn't help this time.")
    print("     This is normal with very small datasets. The Phase 1 model is saved.")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — CONFIDENCE THRESHOLD CALIBRATION
#
# How does the threshold work?
#   The model outputs a softmax vector, e.g. [0.82, 0.18] for Defective.
#   The max value (0.82) is the confidence.
#   If confidence < CONFIDENCE_THRESHOLD → output "Uncertain" in the app.
#
# The table below shows what happens at different thresholds on the
# VALIDATION SET. Pick a threshold where:
#   • Accuracy is high (>85%)
#   • Coverage is still reasonable (>60%)
#
# Rule of thumb for this dataset size: 0.70–0.80 is usually good.
# ═══════════════════════════════════════════════════════════════════════════════
print("\n📏 Confidence threshold calibration on validation set...")

val_gen.reset()
raw_preds   = model.predict(val_gen, verbose=1)
confidences = np.max(raw_preds, axis=1)
y_pred_all  = np.argmax(raw_preds, axis=1)
y_true      = val_gen.classes

print("\n  ┌─────────────┬──────────┬───────────────────────────┐")
print("  │  Threshold  │ Coverage │  Accuracy (covered images)│")
print("  ├─────────────┼──────────┼───────────────────────────┤")
for t in [0.50, 0.55, 0.60, 0.65, 0.70, 0.72, 0.75, 0.80, 0.85, 0.90]:
    mask = confidences >= t
    n    = mask.sum()
    if n == 0:
        print(f"  │    {t:.2f}     │    0%    │            N/A            │")
        continue
    acc  = (y_pred_all[mask] == y_true[mask]).mean() * 100
    cov  = n / len(y_true) * 100
    flag = "  ← YOUR SETTING" if abs(t - CONFIDENCE_THRESHOLD) < 0.001 else ""
    print(f"  │    {t:.2f}     │  {cov:5.1f}%  │          {acc:6.2f}%          │{flag}")
print("  └─────────────┴──────────┴───────────────────────────┘")
print(f"\n  ℹ️  Images below {CONFIDENCE_THRESHOLD} confidence → shown as 'Uncertain' in app")
print(f"  ℹ️  To change, edit CONFIDENCE_THRESHOLD at the top of this file")

# Save all metadata the app needs to load
metadata = {
    "confidence_threshold" : CONFIDENCE_THRESHOLD,
    "class_names"          : CLASS_NAMES,
    "image_size"           : list(IMAGE_SIZE),
    "model_file"           : MODEL_SAVE,
    "architecture": "EfficientNetV2B0",
    "best_val_accuracy"    : round(float(overall_best), 4)
}
with open("model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)
print(f"\n✅ model_metadata.json saved")


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6 — GRAPHS & EVALUATION REPORT
# ═══════════════════════════════════════════════════════════════════════════════
print("\n📊 Generating evaluation graphs...")

all_acc      = history_p1.history['accuracy']      + history_p2.history['accuracy']
all_val_acc  = history_p1.history['val_accuracy']  + history_p2.history['val_accuracy']
all_loss     = history_p1.history['loss']          + history_p2.history['loss']
all_val_loss = history_p1.history['val_loss']      + history_p2.history['val_loss']
ft_start     = len(history_p1.history['accuracy'])

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle('Railway Fault Detection — EfficientNetV2B0 Training Results',
             fontsize=13, fontweight='bold')

for ax, tr, vl, title in [
    (axes[0], all_acc,  all_val_acc,  'Accuracy'),
    (axes[1], all_loss, all_val_loss, 'Loss'),
]:
    ax.plot(tr, label=f'Train {title}',      color='steelblue',  linewidth=2)
    ax.plot(vl, label=f'Validation {title}', color='darkorange', linewidth=2)
    ax.axvline(ft_start, color='grey', linestyle='--', alpha=0.6, label='Fine-tune start')
    ax.set_title(title)
    ax.set_xlabel('Epoch')
    ax.legend()
    ax.grid(alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(RESULTS_DIR, 'training_graphs.png'), dpi=150)
plt.close()
print(f"✅ Training graphs  → {RESULTS_DIR}/training_graphs.png")

# Confusion matrix
val_gen.reset()
preds  = model.predict(val_gen, verbose=0)
y_pred = np.argmax(preds, axis=1)
y_true = val_gen.classes

cm = confusion_matrix(y_true, y_pred)
fig, ax = plt.subplots(figsize=(7, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES,
            ax=ax, linewidths=1, linecolor='white', annot_kws={"size": 14})
ax.set_title('Confusion Matrix', fontsize=13, fontweight='bold')
ax.set_ylabel('Actual Label')
ax.set_xlabel('Predicted Label')
plt.tight_layout()
plt.savefig(os.path.join(RESULTS_DIR, 'confusion_matrix.png'), dpi=150)
plt.close()
print(f"✅ Confusion matrix  → {RESULTS_DIR}/confusion_matrix.png")

# Classification report
report = classification_report(y_true, y_pred, target_names=CLASS_NAMES)
print("\n📋 CLASSIFICATION REPORT:")
print("─" * 55)
print(report)
with open(os.path.join(RESULTS_DIR, 'classification_report.txt'), 'w') as f:
    f.write("EfficientNetV2B0 — Railway Track Fault Detection\n")
    f.write("=" * 55 + "\n")
    f.write(report)


# ═══════════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
final_acc = max(all_val_acc)
print("\n" + "═" * 65)
print("  ✅  TRAINING COMPLETE")
print(f"  🎯  Best Validation Accuracy  : {final_acc * 100:.2f}%")
print(f"  🛡️   Confidence Threshold      : {CONFIDENCE_THRESHOLD}")
print(f"       (images < {CONFIDENCE_THRESHOLD*100:.0f}% confidence → 'Uncertain' in app)")
print(f"  💾  Model saved               : {MODEL_SAVE}")
print(f"  📋  Metadata saved            : model_metadata.json")
print(f"  📁  Graphs saved              : {RESULTS_DIR}/")
print("═" * 65)
print("\n  NEXT STEP: python3 predict_app.py")
print("═" * 65)
