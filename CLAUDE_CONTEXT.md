# Railway Track Fault Detection System — Claude Documentation Context

This document is a self-contained context package for the **Railway Track Fault Detection System** project. Pass this document directly to Claude to generate comprehensive project documentation, READMEs, technical reports, presentation materials, or API guides.

---

## 1. Project Overview & Objective

The **Railway Track Fault Detection System** is an end-to-end computer vision and deep learning solution designed to detect structural faults and defects in railway tracks. 

- **Goal**: Analyze images of railway tracks to identify whether they are **Defective** or **Non_Defective** (Safe).
- **Core Challenge**: The training dataset is relatively small (~300 images), necessitating advanced transfer learning, robust data augmentation, class weight balancing, and careful fine-tuning strategies.
- **Key Safety Mechanisms**:
  - **Confidence Thresholding**: Prevents the model from making "confidently wrong" assertions on irrelevant, blurry, or ambiguous images by categorizing predictions below a threshold (default: `0.72`) as **Uncertain**.
  - **Severity Grading**: Dynamically scales the defect severity into **CRITICAL** ($\ge 92\%$), **HIGH** ($\ge 82\%$), and **MEDIUM** ($< 82\%$) confidences, each triggering specific operational protocols (e.g., immediate traffic halts vs. scheduled checkups).

---

## 2. Directory Structure

```text
IITR/ (Project Root)
├── .gitignore                          # Excludes models, datasets, and caches
├── README.md                           # Initial basic README
├── CLAUDE_CONTEXT.md                   # This context file
└── RAILWAY_DEFECT/                     # Core workspace
    ├── class_names.json                # Saved class labels (["Defective", "Non_Defective"])
    ├── model_metadata.json             # Calibration configuration & best accuracy
    ├── inspection_report.csv           # Diagnostic log entries
    ├── predict_app.py                  # Gradio Web Dashboard application
    ├── quick_test.py                   # CLI tool to test a single image
    ├── train_model.py                  # Model training and fine-tuning pipeline
    ├── requirements.txt                # Python package dependencies
    └── results/                        # Generated training evaluation artifacts
        ├── classification_report.txt   # Precision, recall, f1-score per class
        ├── confusion_matrix.png        # Confusion matrix plot
        └── training_graphs.png         # Train vs Val accuracy & loss curves
```

---

## 3. Technology Stack & Dependencies

The project is built using:
- **Core ML Framework**: TensorFlow 2.18.0 & Keras (supports Apple Silicon GPU acceleration via `tensorflow-metal`)
- **Data Prep & Operations**: NumPy, Scikit-learn
- **Visualization**: Matplotlib, Seaborn
- **Interactive UI**: Gradio ($\ge 4.0.0$)
- **Image Processing**: Pillow (PIL)

---

## 4. Deep Learning Architecture & Training Pipeline (`train_model.py`)

### A. Pre-trained Base Model
- **Base**: **EfficientNetV2B0** (pretrained on ImageNet).
- **Why EfficientNetV2B0?** It features progressive learning and is optimized for speed and parameters. It is lighter (~30% fewer parameters than DenseNet121), which heavily mitigates overfitting risks on small datasets while maintaining high accuracy.

### B. Classification Head
- Compressed output via `GlobalAveragePooling2D`
- `Dropout(0.3)` to enforce regularization and prevent node co-dependency.
- `Dense(2, activation='softmax')` for the final class probabilities.

### C. Advanced Training Techniques
1. **Tamed Data Augmentation**: Since railway tracks are highly structured, we use tamed image augmentations:
   - Rotation limited to $15^\circ$
   - Width/Height shifting limited to $10\%$
   - Horizontal flip enabled, but vertical flip disabled (tracks do not run upside down).
   - Tamed brightness adjustment ($0.75$ to $1.25$).
2. **Label Smoothing**: A cross-entropy loss setting (`label_smoothing=0.10`) that stops the model from aiming for absolute $1.0$ confidence targets. This explicitly curbs overconfidence.
3. **Class Weight Balancing**: Automatically computes and applies weights to the loss function based on dataset distribution using `compute_class_weight` to address class imbalances.
4. **Two-Phase Fine-Tuning**:
   - **Phase 1 (Head Only)**: Base model is locked. Only the dense classification head is trained (`Adam`, $LR = 10^{-3}$, 30 epochs) with an `EarlyStopping` callback.
   - **Phase 2 (Fine-Tuning)**: Unfreezes the upper layers (`block5`, `block6`, and `top`) of the base model. An extremely low learning rate ($LR = 10^{-4}$) prevents catastrophic forgetting of ImageNet features. Batch Normalization (`BatchNormalization`) layers are kept locked throughout to maintain gradient stability.
5. **Custom Callback (`SaveIfBetter`)**:
   - Tracks global validation accuracy across both Phase 1 and Phase 2.
   - Prevents Phase 2 from overwriting a higher accuracy model achieved in Phase 1 if the fine-tuning phase overfits.

### D. Post-Training Calibration
- Validates model prediction probabilities against multiple cutoffs ($0.50$ to $0.90$).
- Generates a **Coverage vs. Accuracy** table to help operators choose a optimal safety threshold (default is configured at `0.72`).
- Saves details to `model_metadata.json`.

---

## 5. Web Interface & Inference (`predict_app.py`)

The user-facing system runs as a custom-styled Gradio web dashboard:
- **UI Design**: Uses dark-theme glassmorphism CSS (`#0b0f19` canvas, Orbitron typography, glow effects, color-graded state cards).
- **Dynamic Decision Logic**:
  - If prediction confidence is **below** the `confidence_threshold` (e.g., `< 72%`), it renders an **Uncertain Diagnostic** card requesting a clearer photo.
  - If **Non_Defective** with high confidence, it displays a green **Track is Safe** card.
  - If **Defective** with high confidence, it outputs a red **Fault Detected** card showing the confidence score and safety level:
    - **CRITICAL** ($\ge 92\%$): Triggers "HALT TRAFFIC" immediate operational protocol.
    - **HIGH** ($\ge 82\%$): Triggers "Alert Maintenance / Speed Restrictions" protocol.
    - **MEDIUM** ($< 82\%$): Triggers "Schedule standard inspection" protocol.

---

## 6. Complete Project Source Code

Below is the exact code for the main files in the workspace. Feed these directly to Claude to analyze implementation details.

### A. Training Pipeline: `RAILWAY_DEFECT/train_model.py`
```python
"""
train_model.py — Railway Track Fault Detection (Improved v2)
=============================================================
Key features:
- EfficientNetV2B0 base architecture
- Tamed Augmentations & Class weight balancing
- Two-Phase Training (Classification Head -> Fine-tuning top blocks)
- Global Callback preservation (SaveIfBetter)
- Accuracy vs. Coverage Calibration Table
"""
import os, json, ssl
ssl._create_default_https_context = ssl._create_unverified_context

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import tensorflow as tf

from tensorflow.keras.applications        import EfficientNetV2B0
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input
from tensorflow.keras.layers              import GlobalAveragePooling2D, Dense, Dropout
from tensorflow.keras.models              import Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks           import EarlyStopping, ReduceLROnPlateau
from sklearn.metrics                      import classification_report, confusion_matrix
from sklearn.utils.class_weight           import compute_class_weight

DATASET_PATH = "/Users/souvik/Desktop/MY_CODES/Projects/IITR/RAILWAY_DEFECT/railway_fault_detector/dataset"
IMAGE_SIZE   = (224, 224)
BATCH_SIZE   = 16
EPOCHS_HEAD  = 30
EPOCHS_FINE  = 30
LR_HEAD      = 1e-3
LR_FINE      = 1e-4
CONFIDENCE_THRESHOLD = 0.72
MODEL_SAVE   = "railway_model.keras"
RESULTS_DIR  = "results"
os.makedirs(RESULTS_DIR, exist_ok=True)

print("📂 Loading images from dataset...")
train_datagen = ImageDataGenerator(
    preprocessing_function = preprocess_input,
    rotation_range         = 15,
    width_shift_range      = 0.10,
    height_shift_range     = 0.10,
    shear_range            = 0.10,
    zoom_range             = 0.15,
    horizontal_flip        = True,
    vertical_flip          = False,
    brightness_range       = [0.75, 1.25],
    channel_shift_range    = 10.0,
    fill_mode              = 'nearest',
    validation_split       = 0.2
)

val_datagen = ImageDataGenerator(
    preprocessing_function = preprocess_input,
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

with open("class_names.json", "w") as f:
    json.dump(CLASS_NAMES, f)

weights_arr  = compute_class_weight(
    class_weight = 'balanced',
    classes      = np.unique(train_gen.classes),
    y            = train_gen.classes
)
class_weights = {i: float(w) for i, w in enumerate(weights_arr)}

print("\n🧠 Building model (EfficientNetV2B0)...")
base_model = EfficientNetV2B0(
    input_shape = (*IMAGE_SIZE, 3),
    include_top = False,
    weights     = 'imagenet'
)
base_model.trainable = False

x       = base_model.output
x       = GlobalAveragePooling2D()(x)
x       = Dropout(0.3)(x)
outputs = Dense(NUM_CLASSES, activation='softmax')(x)

model = Model(inputs=base_model.input, outputs=outputs, name="RailwayFaultDetector_v2")
model.compile(
    optimizer = tf.keras.optimizers.Adam(learning_rate=LR_HEAD),
    loss      = tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.10),
    metrics   = ['accuracy']
)

class SaveIfBetter(tf.keras.callbacks.Callback):
    def __init__(self, filepath, baseline=0.0):
        super().__init__()
        self.filepath = filepath
        self.best     = baseline

    def on_epoch_end(self, epoch, logs=None):
        val_acc = logs.get('val_accuracy', 0.0)
        if val_acc > self.best:
            self.best = val_acc
            self.model.save(self.filepath)
            print(f"\n  💾  New global best: {val_acc:.4f} → saved {self.filepath}")

print("\nPhase 1: Training classification head...")
p1_checkpoint = SaveIfBetter(filepath=MODEL_SAVE, baseline=0.0)
callbacks_p1 = [
    EarlyStopping(monitor='val_accuracy', patience=15, restore_best_weights=True, verbose=1, mode='max'),
    p1_checkpoint,
    ReduceLROnPlateau(monitor='val_loss', factor=0.50, patience=3, min_lr=1e-7, verbose=1)
]

history_p1 = model.fit(
    train_gen, validation_data=val_gen, epochs=EPOCHS_HEAD,
    callbacks=callbacks_p1, class_weight=class_weights
)
best_p1_acc = max(history_p1.history['val_accuracy'])

print("\nPhase 2: Fine-tuning top 40% of EfficientNetV2B0...")
base_model.trainable = True
for layer in base_model.layers:
    if isinstance(layer, tf.keras.layers.BatchNormalization):
        layer.trainable = False
    elif any(block_name in layer.name for block_name in ['block5', 'block6', 'top']):
        layer.trainable = True
    else:
        layer.trainable = False

model.compile(
    optimizer = tf.keras.optimizers.Adam(learning_rate=LR_FINE),
    loss      = tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.10),
    metrics   = ['accuracy']
)

p2_checkpoint = SaveIfBetter(filepath=MODEL_SAVE, baseline=best_p1_acc)
phase1_epochs = len(history_p1.history['accuracy'])
callbacks_p2 = [
    EarlyStopping(monitor='val_accuracy', patience=8, restore_best_weights=True, verbose=1, mode='max'),
    p2_checkpoint,
    ReduceLROnPlateau(monitor='val_loss', factor=0.40, patience=3, min_lr=1e-8, verbose=1)
]

history_p2 = model.fit(
    train_gen, validation_data=val_gen, epochs=phase1_epochs + EPOCHS_FINE,
    initial_epoch=phase1_epochs, callbacks=callbacks_p2, class_weight=class_weights
)

best_p2_acc = max(history_p2.history['val_accuracy'])
overall_best = max(best_p1_acc, best_p2_acc)

print("\n📏 Calibration on validation set...")
val_gen.reset()
raw_preds = model.predict(val_gen, verbose=1)
confidences = np.max(raw_preds, axis=1)
y_pred_all = np.argmax(raw_preds, axis=1)
y_true = val_gen.classes

for t in [0.50, 0.55, 0.60, 0.65, 0.70, 0.72, 0.75, 0.80, 0.85, 0.90]:
    mask = confidences >= t
    n = mask.sum()
    if n == 0:
        continue
    acc = (y_pred_all[mask] == y_true[mask]).mean() * 100
    cov = n / len(y_true) * 100
    flag = "  ← CURRENT SETTING" if abs(t - CONFIDENCE_THRESHOLD) < 0.001 else ""
    print(f"  Threshold: {t:.2f} | Coverage: {cov:5.1f}% | Accuracy: {acc:6.2f}%{flag}")

metadata = {
    "confidence_threshold" : CONFIDENCE_THRESHOLD,
    "class_names"          : CLASS_NAMES,
    "image_size"           : list(IMAGE_SIZE),
    "model_file"           : MODEL_SAVE,
    "architecture"         : "EfficientNetV2B0",
    "best_val_accuracy"    : round(float(overall_best), 4)
}
with open("model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print("\n📊 Generating graphs...")
all_acc      = history_p1.history['accuracy']      + history_p2.history['accuracy']
all_val_acc  = history_p1.history['val_accuracy']  + history_p2.history['val_accuracy']
all_loss     = history_p1.history['loss']          + history_p2.history['loss']
all_val_loss = history_p1.history['val_loss']      + history_p2.history['val_loss']
ft_start     = len(history_p1.history['accuracy'])

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
for ax, tr, vl, title in [(axes[0], all_acc, all_val_acc, 'Accuracy'), (axes[1], all_loss, all_val_loss, 'Loss')]:
    ax.plot(tr, label='Train', color='steelblue')
    ax.plot(vl, label='Val', color='darkorange')
    ax.axvline(ft_start, color='grey', linestyle='--', alpha=0.6)
    ax.set_title(title)
    ax.legend()
plt.tight_layout()
plt.savefig(os.path.join(RESULTS_DIR, 'training_graphs.png'), dpi=150)
plt.close()
```

### B. Gradio Dashboard: `RAILWAY_DEFECT/predict_app.py`
```python
"""
predict_app.py — Gradio Dashboard Application (v2)
===================================================
Uses custom dark-themed CSS and displays highly actionable visual results.
Supports three types of result cards: Safe, Defective (Critical, High, Medium), and Uncertain.
"""
import json, os
import numpy as np
import gradio as gr
from PIL import Image
import tensorflow as tf
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as eff_preprocess
from tensorflow.keras.applications.densenet        import preprocess_input as dense_preprocess

def load_model_and_config():
    if os.path.exists("model_metadata.json"):
        with open("model_metadata.json") as f:
            meta = json.load(f)
    else:
        meta = {
            "confidence_threshold" : 0.72,
            "class_names"          : ["Defective", "Non_Defective"],
            "image_size"           : [224, 224],
            "architecture"         : "EfficientNetV2B0"
        }

    class_names          = meta["class_names"]
    confidence_threshold = float(meta["confidence_threshold"])
    image_size           = tuple(meta["image_size"])
    architecture         = meta.get("architecture", "EfficientNetV2B0")

    preprocess_fn = eff_preprocess if "EfficientNet" in architecture else dense_preprocess

    for path in ["railway_model.keras", "railway_model.h5"]:
        if os.path.exists(path):
            try:
                loaded_model = tf.keras.models.load_model(path)
                return loaded_model, class_names, confidence_threshold, image_size, preprocess_fn, architecture
            except Exception as e:
                print(f"⚠️ Load failed: {path} ({e})")
    raise FileNotFoundError("Model file not found! Run training first.")

model, CLASS_NAMES, CONFIDENCE_THRESHOLD, IMAGE_SIZE, preprocess_fn, ARCHITECTURE = load_model_and_config()

def make_safe_card(confidence):
    return f"""
    <div class="result-card card-safe">
        <h3>TRACK IS SAFE</h3>
        <p>Confidence: {confidence * 100:.1f}%</p>
        <p>No defects detected. Proceed with standard schedule.</p>
    </div>
    """

def make_defective_card(confidence, severity, note):
    icon = "🚨" if severity == "CRITICAL" else "⚠️" if severity == "HIGH" else "🟡"
    return f"""
    <div class="result-card card-defective">
        <h3>{icon} FAULT DETECTED ({severity})</h3>
        <p>Confidence: {confidence * 100:.1f}%</p>
        <p><strong>Assessment:</strong> {note}</p>
    </div>
    """

def make_uncertain_card(confidence, threshold):
    return f"""
    <div class="result-card card-uncertain">
        <h3>UNCERTAIN DIAGNOSTIC</h3>
        <p>Confidence: {confidence * 100:.1f}% (Required: {threshold * 100:.0f}%)</p>
        <p>Please check camera angle/lighting and re-upload.</p>
    </div>
    """

def predict_track(img: Image.Image):
    if img is None:
        return "Please upload an image.", {}

    img_rgb     = img.convert("RGB").resize(IMAGE_SIZE)
    img_array   = np.array(img_rgb, dtype=np.float32)
    img_array   = np.expand_dims(img_array, axis=0)
    img_array   = preprocess_fn(img_array)

    predictions = model.predict(img_array, verbose=0)[0]
    max_conf    = float(np.max(predictions))
    pred_idx    = int(np.argmax(predictions))
    pred_class  = CLASS_NAMES[pred_idx]

    conf_scores = {name: float(p) for name, p in zip(CLASS_NAMES, predictions)}

    if max_conf < CONFIDENCE_THRESHOLD:
        return make_uncertain_card(max_conf, CONFIDENCE_THRESHOLD), conf_scores

    if pred_class == "Defective":
        if max_conf >= 0.92:
            severity, note = "CRITICAL", "Immediate traffic suspension required."
        elif max_conf >= 0.82:
            severity, note = "HIGH", "Schedule rapid crew response."
        else:
            severity, note = "MEDIUM", "Routine safety inspection review."
        return make_defective_card(max_conf, severity, note), conf_scores
    else:
        return make_safe_card(max_conf), conf_scores

# Custom dashboard CSS
custom_css = """
body, .gradio-container { background-color: #0b0f19 !important; color: #f1f5f9 !important; }
.dashboard-title { font-family: 'Orbitron', sans-serif !important; background: linear-gradient(135deg, #fff, #94a3b8) !important; -webkit-background-clip: text !important; -webkit-text-fill-color: transparent !important; }
.result-card { border-radius: 12px; padding: 24px; margin-top: 5px; }
.card-safe { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); }
.card-defective { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); }
.card-uncertain { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); }
"""

with gr.Blocks(title="Railway Track Fault Detector") as app:
    gr.HTML("<h1 class='dashboard-title'>🚂 RAILWAY TRACK INSPECT AI</h1>")
    with gr.Row():
        with gr.Column():
            img_input   = gr.Image(type="pil", label="Upload Image")
            analyze_btn = gr.Button("Analyze Track")
        with gr.Column():
            html_out   = gr.HTML()
            conf_out   = gr.Label()

    analyze_btn.click(fn=predict_track, inputs=[img_input], outputs=[html_out, conf_out])

if __name__ == "__main__":
    app.launch()
```

### C. CLI Verification Tool: `RAILWAY_DEFECT/quick_test.py`
```python
"""
quick_test.py — Command-Line Prediction Tool
=============================================
Usage: python quick_test.py path/to/image.jpg
"""
import sys, json, os
import numpy as np
import tensorflow as tf
from PIL import Image
from tensorflow.keras.preprocessing.image import img_to_array
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as eff_preprocess
from tensorflow.keras.applications.densenet import preprocess_input as dense_preprocess

if os.path.exists("model_metadata.json"):
    with open("model_metadata.json") as f:
        meta = json.load(f)
else:
    meta = {"confidence_threshold": 0.72, "class_names": ["Defective", "Non_Defective"], "image_size": [224, 224], "architecture": "EfficientNetV2B0"}

CLASS_NAMES = meta["class_names"]
IMAGE_SIZE = tuple(meta["image_size"])
architecture = meta.get("architecture", "EfficientNetV2B0")

model = None
for path in ["railway_model.keras", "railway_model.h5"]:
    if os.path.exists(path):
        try:
            model = tf.keras.models.load_model(path)
            break
        except Exception as e:
            pass

if model is None:
    sys.exit("Model not found! Run train_model.py first.")

preprocess_fn = eff_preprocess if "EfficientNet" in architecture else dense_preprocess

def predict_single_image(image_path: str) -> None:
    try:
        img = Image.open(image_path).convert("RGB").resize(IMAGE_SIZE)
    except Exception as e:
        sys.exit(f"Error loading image: {e}")

    arr = img_to_array(img)
    arr = np.expand_dims(arr, axis=0)
    arr = preprocess_fn(arr)
    
    preds = model.predict(arr, verbose=0)[0]
    idx = int(np.argmax(preds))
    label = CLASS_NAMES[idx]
    confidence = preds[idx] * 100

    print(f"\nPrediction : {label} ({confidence:.1f}%)")
    for i, name in enumerate(CLASS_NAMES):
        print(f"  {name}: {preds[i]*100:.2f}%")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: python quick_test.py <path_to_image>")
    predict_single_image(sys.argv[1])
```
