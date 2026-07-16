"""
predict_app.py — Railway Track Fault Detection Web App (Improved v2)
=====================================================================
Key fixes over v1:
  ✅  Confidence threshold — irrelevant images now return "Uncertain" 
      instead of a false Defective/Non_Defective result
  ✅  Severity levels — HIGH / MEDIUM / LOW based on confidence level
  ✅  Loads model_metadata.json — threshold and settings are auto-loaded
  ✅  Fallback loading — tries .keras first, then .h5 for compatibility
  ✅  Clear action guidance — tells the user what to do with each result
"""

import json, os
import numpy as np
import gradio as gr
from PIL import Image
import tensorflow as tf
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as eff_preprocess
from tensorflow.keras.applications.densenet        import preprocess_input as dense_preprocess


# ═══════════════════════════════════════════════════════════════════════════════
# LOAD MODEL AND METADATA
# ═══════════════════════════════════════════════════════════════════════════════

def load_model_and_config():
    """Load model and settings. Tries .keras (new) then .h5 (old) format."""

    # Load metadata (confidence threshold, class names, which architecture was used)
    if os.path.exists("model_metadata.json"):
        with open("model_metadata.json") as f:
            meta = json.load(f)
        print(f"✅ model_metadata.json loaded: {meta}")
    else:
        # Fallback defaults — these match v1 settings
        print("⚠️  model_metadata.json not found — using fallback defaults")
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

    # Choose the right preprocessing function for the architecture used
    if "EfficientNet" in architecture:
        preprocess_fn = eff_preprocess
    else:
        # DenseNet121 or other
        preprocess_fn = dense_preprocess

    # Try to load model — new .keras format first, legacy .h5 second
    for path in ["railway_model.keras", "railway_model.h5"]:
        if os.path.exists(path):
            try:
                loaded_model = tf.keras.models.load_model(path)
                print(f"✅ Model loaded: {path}")
                return loaded_model, class_names, confidence_threshold, image_size, preprocess_fn, architecture
            except Exception as e:
                print(f"  ⚠️  Could not load {path}: {e}")

    raise FileNotFoundError(
        "No model file found! Run train_model.py first to create railway_model.keras"
    )


print("\nLoading model — please wait...")
model, CLASS_NAMES, CONFIDENCE_THRESHOLD, IMAGE_SIZE, preprocess_fn, ARCHITECTURE = load_model_and_config()
print(f"  Classes            : {CLASS_NAMES}")
print(f"  Confidence cutoff  : {CONFIDENCE_THRESHOLD} ({CONFIDENCE_THRESHOLD*100:.0f}%)")
print(f"  Input size         : {IMAGE_SIZE}")
print("Ready!\n")


# ═══════════════════════════════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════════════════════════════
# HTML RESULT CARD GENERATORS
# ═══════════════════════════════════════════════════════════════════════════════

def make_safe_card(confidence):
    return f"""
    <div class="result-card card-safe">
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background-color: #10b981; color: white; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-right: 15px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                ✓
            </div>
            <div>
                <h3 style="margin: 0; color: #34d399; font-size: 1.3em; font-weight: 700; letter-spacing: 0.5px;">TRACK IS SAFE</h3>
                <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 0.9em; font-weight: 600;">Confidence: {confidence * 100:.1f}%</p>
            </div>
        </div>
        <div style="background-color: rgba(17, 24, 39, 0.4); border-radius: 10px; padding: 14px; border-left: 4px solid #10b981;">
            <strong style="color: #34d399; display: block; margin-bottom: 4px; font-size: 0.95em;">Assessment:</strong>
            <span style="color: #cbd5e1; font-size: 0.95em;">No visible structural faults or defects detected. The rail track section appears stable and safe for operations.</span>
        </div>
        <div style="margin-top: 15px;">
            <h4 style="margin: 0 0 8px 0; color: #a7f3d0; font-size: 1em; font-weight: 600;">Recommended Actions:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; line-height: 1.6; font-size: 0.9em;">
                <li>Log current inspection run as 'Passed'.</li>
                <li>Continue standard scheduled track maintenance checks.</li>
            </ul>
        </div>
    </div>
    """

def make_defective_card(confidence, severity, note):
    if severity == "CRITICAL":
        badge_style = "background-color: #ef4444; color: white;"
        card_border = "border: 1px solid #ef4444;"
        glow_color = "rgba(239, 68, 68, 0.2)"
        icon = "🚨"
    elif severity == "HIGH":
        badge_style = "background-color: #f97316; color: white;"
        card_border = "border: 1px solid #f97316;"
        glow_color = "rgba(249, 115, 22, 0.15)"
        icon = "⚠️"
    else:  # MEDIUM
        badge_style = "background-color: #facc15; color: black;"
        card_border = "border: 1px solid #facc15;"
        glow_color = "rgba(250, 204, 21, 0.1)"
        icon = "🟡"

    halt_step = "<li><strong>HALT TRAFFIC</strong>: Suspend train operations on this segment immediately.</li>" if severity == "CRITICAL" else ""

    return f"""
    <div class="result-card card-defective" style="{card_border} box-shadow: 0 10px 25px {glow_color};">
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background-color: #ef4444; color: white; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-right: 15px; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);">
                {icon}
            </div>
            <div>
                <h3 style="margin: 0; color: #f87171; font-size: 1.3em; font-weight: 700; letter-spacing: 0.5px;">FAULT DETECTED</h3>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                    <span style="color: #fca5a5; font-weight: 600; font-size: 0.9em;">Confidence: {confidence * 100:.1f}%</span>
                    <span style="font-size: 0.8em; font-weight: 800; padding: 2px 8px; border-radius: 20px; {badge_style}">{severity}</span>
                </div>
            </div>
        </div>
        <div style="background-color: rgba(17, 24, 39, 0.4); border-radius: 10px; padding: 14px; border-left: 4px solid #ef4444; margin-bottom: 15px;">
            <strong style="color: #fca5a5; display: block; margin-bottom: 4px; font-size: 0.95em;">Assessment:</strong>
            <span style="color: #cbd5e1; font-size: 0.95em;">{note}</span>
        </div>
        <div>
            <h4 style="margin: 0 0 8px 0; color: #fca5a5; font-size: 1em; font-weight: 600;">Immediate Operational Protocol:</h4>
            <ol style="margin: 0; padding-left: 20px; color: #cbd5e1; line-height: 1.6; font-size: 0.9em;">
                <li><strong>Log Incident</strong>: Record track coordinates and time stamps.</li>
                <li><strong>Alert Maintenance</strong>: Dispatch physical inspection crew.</li>
                <li><strong>Restrict Speed</strong>: Impose slow-order restrictions on this segment.</li>
                {halt_step}
            </ol>
        </div>
        <div style="margin-top: 15px; font-size: 0.8em; color: #f87171; opacity: 0.8; border-top: 1px dashed rgba(239, 68, 68, 0.2); padding-top: 10px;">
            ⚠️ <strong>AI NOTICE</strong>: This is an automated assessment. Always verify with qualified safety inspectors.
        </div>
    </div>
    """

def make_uncertain_card(confidence, threshold):
    return f"""
    <div class="result-card card-uncertain">
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background-color: #f59e0b; color: white; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-right: 15px; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);">
                ?
            </div>
            <div>
                <h3 style="margin: 0; color: #fbbf24; font-size: 1.3em; font-weight: 700; letter-spacing: 0.5px;">UNCERTAIN DIAGNOSTIC</h3>
                <p style="margin: 2px 0 0 0; color: #fde68a; font-size: 0.9em; font-weight: 600;">Confidence: {confidence * 100:.1f}% (Required: {threshold * 100:.0f}%)</p>
            </div>
        </div>
        <div style="background-color: rgba(17, 24, 39, 0.4); border-radius: 10px; padding: 14px; border-left: 4px solid #f59e0b; margin-bottom: 15px;">
            <strong style="color: #fbbf24; display: block; margin-bottom: 4px; font-size: 0.95em;">Explanation:</strong>
            <span style="color: #cbd5e1; font-size: 0.95em;">The model's classification confidence is below the safety threshold.</span>
        </div>
        <div>
            <h4 style="margin: 0 0 8px 0; color: #fde68a; font-size: 1em; font-weight: 600;">How to resolve:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; line-height: 1.6; font-size: 0.9em;">
                <li>Ensure the track image is clear, sharp, and well-lit.</li>
                <li>Make sure the rail track occupies the center of the frame.</li>
                <li>Avoid uploading photos containing irrelevant background objects.</li>
            </ul>
        </div>
    </div>
    """


# ═══════════════════════════════════════════════════════════════════════════════
# PREDICTION FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def predict_track(img: Image.Image):
    """
    Takes a PIL image and returns:
      1. html_card   — styled HTML output display
      2. conf_scores — dict for Gradio's confidence bar chart
    """

    if img is None:
        return "<div class='placeholder-card'>📷 Please upload a track image to begin analysis.</div>", {}

    # ── 1. Preprocess the image ──────────────────────────────────────────────
    img_rgb     = img.convert("RGB").resize(IMAGE_SIZE)        # Ensure RGB, resize
    img_array   = np.array(img_rgb, dtype=np.float32)
    img_array   = np.expand_dims(img_array, axis=0)            # Add batch dimension → (1, H, W, 3)
    img_array   = preprocess_fn(img_array)                     # Model-specific normalization

    # ── 2. Run inference ──────────────────────────────────────────────────────
    predictions = model.predict(img_array, verbose=0)[0]       # Shape: (num_classes,)
    max_conf    = float(np.max(predictions))
    pred_idx    = int(np.argmax(predictions))
    pred_class  = CLASS_NAMES[pred_idx]

    # Confidence bars — shown in the Gradio label component
    conf_scores = {name: float(p) for name, p in zip(CLASS_NAMES, predictions)}

    # ── 3. Confidence threshold check ─────────────────────────────────────────
    if max_conf < CONFIDENCE_THRESHOLD:
        return make_uncertain_card(max_conf, CONFIDENCE_THRESHOLD), conf_scores

    # ── 4. Generate result card ──────────────────────────────────────────────
    if pred_class == "Defective":
        # Severity level based on how confident the model is
        if max_conf >= 0.92:
            severity = "CRITICAL"
            note = "Very high confidence defect detected. Immediate intervention required to prevent derailment risks."
        elif max_conf >= 0.82:
            severity = "HIGH"
            note = "Strong evidence of structural track defect. Schedule physical maintenance crew inspection."
        else:
            severity = "MEDIUM"
            note = "Moderate confidence defect detected. Schedule standard track inspection to confirm status."

        return make_defective_card(max_conf, severity, note), conf_scores

    else:   # Non_Defective
        return make_safe_card(max_conf), conf_scores


# ═══════════════════════════════════════════════════════════════════════════════
# GRADIO WEB INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════

custom_css = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@500;700;900&display=swap');

/* Main container background */
body, .gradio-container {
    background-color: #0b0f19 !important;
    color: #f1f5f9 !important;
    font-family: 'Inter', sans-serif !important;
}

/* Header & Title styling */
.dashboard-title {
    font-family: 'Orbitron', sans-serif !important;
    background: linear-gradient(135deg, #ffffff, #94a3b8) !important;
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    text-align: center;
    font-weight: 900 !important;
    letter-spacing: 2px;
    margin-bottom: 5px !important;
    font-size: 2.2em !important;
}

.dashboard-subtitle {
    text-align: center;
    color: #64748b !important;
    font-size: 1.1em;
    margin-bottom: 25px !important;
    font-weight: 500;
}

/* System calibration pill with orange-yellow gradient */
.calibration-pill {
    display: inline-block;
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(250, 204, 21, 0.15)) !important;
    border: 1px solid rgba(249, 115, 22, 0.3) !important;
    border-radius: 30px;
    padding: 6px 16px;
    font-size: 0.9em;
    color: #f97316 !important;
    font-weight: 600;
    text-shadow: 0 0 10px rgba(249, 115, 22, 0.2);
}

/* Custom buttons with orange-yellow accent */
.action-button {
    background: linear-gradient(135deg, #f97316, #facc15) !important;
    border: none !important;
    color: #0f172a !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3) !important;
    font-weight: 700 !important;
    border-radius: 12px !important;
    padding: 12px 24px !important;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.action-button:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 25px rgba(249, 115, 22, 0.5) !important;
    filter: brightness(1.1) !important;
}

.action-button:active {
    transform: translateY(0) !important;
}

/* Panel/Blocks container styling */
.block {
    background-color: #111827 !important;
    border: 1px solid #1f2937 !important;
    border-radius: 16px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25) !important;
    padding: 16px !important;
}

/* Hide or clean the ugly label tab background */
.block > span, .block-label {
    background: transparent !important;
    color: #94a3b8 !important;
    font-size: 0.85em !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.08em !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin-bottom: 12px !important;
    display: inline-block !important;
}

/* Styled HTML Cards */
.result-card {
    border-radius: 12px;
    padding: 24px;
    margin-top: 5px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    animation: slideIn 0.4s ease-out;
}

.result-card:hover {
    transform: translateY(-2px);
}

.card-safe {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.1)) !important;
    border: 1px solid rgba(16, 185, 129, 0.3) !important;
    box-shadow: 0 0 25px rgba(16, 185, 129, 0.1) !important;
}

.card-defective {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(220, 38, 38, 0.1)) !important;
    border: 1px solid rgba(239, 68, 68, 0.3) !important;
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.1) !important;
}

.card-uncertain {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(217, 119, 6, 0.1)) !important;
    border: 1px solid rgba(245, 158, 11, 0.3) !important;
    box-shadow: 0 0 25px rgba(245, 158, 11, 0.1) !important;
}

.placeholder-card {
    background-color: #1f2937 !important;
    border: 1px dashed #374151 !important;
    color: #94a3b8 !important;
    padding: 30px 24px !important;
    border-radius: 12px !important;
    text-align: center !important;
    font-weight: 500 !important;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(15px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
"""

with gr.Blocks(title="Railway Track Fault Detector") as app:

    gr.HTML(f"""
    <div style="text-align: center; margin-bottom: 25px;">
        <h1 class="dashboard-title">🚂 RAILWAY TRACK INSPECT AI</h1>
        <p class="dashboard-subtitle">Real-time deep learning diagnostics for structural integrity & defect detection</p>
        <div class="calibration-pill">
            ⚙️ System calibrated at <strong>{CONFIDENCE_THRESHOLD * 100:.0f}%</strong> confidence minimum threshold
        </div>
    </div>
    """)

    with gr.Row():
        with gr.Column(scale=1):
            img_input   = gr.Image(type="pil", label="📷 Upload Track Image")
            analyze_btn = gr.Button("🔍  Analyze Track", variant="primary", size="lg", elem_classes=["action-button"])
            gr.Markdown("""
            **Tips for best results:**
            - Use a clear, well-lit photo
            - Track should fill most of the frame
            - Works with top-down or slight-angle shots
            """)

        with gr.Column(scale=1):
            html_out   = gr.HTML(
                value="<div class='placeholder-card'>📷 Upload a track image and click 'Analyze Track' to get assessment.</div>",
                label="Analysis Results"
            )
            conf_out   = gr.Label(
                label          = "Confidence Scores",
                num_top_classes= len(CLASS_NAMES)
            )

    analyze_btn.click(
        fn      = predict_track,
        inputs  = [img_input],
        outputs = [html_out, conf_out]
    )

    gr.HTML(f"""
    <div style="text-align: center; color: #6b7280; font-size: 0.85em; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
        <strong>Model</strong>: {ARCHITECTURE} &nbsp;|&nbsp; <strong>Input Resolution</strong>: {IMAGE_SIZE[0]}x{IMAGE_SIZE[1]} &nbsp;|&nbsp; <strong>Threshold</strong>: {CONFIDENCE_THRESHOLD * 100:.0f}%
    </div>
    """)

if __name__ == "__main__":
    app.launch(theme=gr.themes.Soft(), css=custom_css)
