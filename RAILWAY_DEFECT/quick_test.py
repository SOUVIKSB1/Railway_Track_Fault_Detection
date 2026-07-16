"""
QUICK TEST — Test the model on a single image from command line.

Usage:
    python quick_test.py path/to/your/image.jpg
"""

import sys
import json
import os
import numpy as np
import tensorflow as tf
from PIL import Image
from tensorflow.keras.preprocessing.image import img_to_array
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as eff_preprocess
from tensorflow.keras.applications.densenet import preprocess_input as dense_preprocess

# Load metadata if it exists
if os.path.exists("model_metadata.json"):
    with open("model_metadata.json") as f:
        meta = json.load(f)
    print(f"✅ Loaded metadata: {meta}")
else:
    meta = {
        "confidence_threshold": 0.72,
        "class_names": ["Defective", "Non_Defective"],
        "image_size": [224, 224],
        "architecture": "EfficientNetV2B0"
    }

CLASS_NAMES = meta["class_names"]
IMAGE_SIZE = tuple(meta["image_size"])
architecture = meta.get("architecture", "EfficientNetV2B0")

# Load model — check .keras first then .h5
model = None
for path in ["railway_model.keras", "railway_model.h5"]:
    if os.path.exists(path):
        try:
            model = tf.keras.models.load_model(path)
            print(f"✅ Loaded model: {path}")
            break
        except Exception as e:
            print(f"⚠️ Could not load {path}: {e}")

if model is None:
    print("❌ Error: No model file found! Run train_model.py first.")
    sys.exit(1)

# Set correct preprocessing
if "EfficientNet" in architecture:
    preprocess_fn = eff_preprocess
else:
    preprocess_fn = dense_preprocess

def predict_single_image(image_path: str) -> None:
    print(f"\n🔍 Analyzing: {image_path}")
    print("─" * 50)

    try:
        img = Image.open(image_path).convert("RGB").resize(IMAGE_SIZE)
    except Exception as e:
        print(f"❌ Error loading image: {e}")
        return

    arr = img_to_array(img)
    arr = np.expand_dims(arr, axis=0)
    arr = preprocess_fn(arr)
    
    preds = model.predict(arr, verbose=0)[0]
    idx = int(np.argmax(preds))
    label = CLASS_NAMES[idx]
    confidence = preds[idx] * 100

    print(f"  Result     : {'⚠️  FAULT DETECTED' if 'defect' in label.lower() else '✅  TRACK IS SAFE'}")
    print(f"  Prediction : {label}")
    print(f"  Confidence : {confidence:.1f}%\n")
    for i, name in enumerate(CLASS_NAMES):
        bar = "█" * int(preds[i] * 20)
        print(f"  {name:20s}: {preds[i]*100:6.2f}%  {bar}")
    print("─" * 50)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python quick_test.py <path_to_image>")
        sys.exit(1)
    predict_single_image(sys.argv[1])
