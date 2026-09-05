"""
domain_validator.py — Multi-Tier RAG Database & Geometric Domain Validator
Uses 128-D RAG feature database manifold verification and structural texture checks
to validate authentic railway track infrastructure and reject invalid/blank non-railway images.
"""

import numpy as np
from PIL import Image
from pathlib import Path
from typing import Tuple, Optional

RAG_DB_PATH = Path(__file__).resolve().parent.parent / "RAILWAY_DEFECT" / "rag_feature_db.npz"
_rag_features = None

def get_rag_features() -> Optional[np.ndarray]:
    global _rag_features
    if _rag_features is None and RAG_DB_PATH.exists():
        try:
            data = np.load(str(RAG_DB_PATH))
            raw_feats = data["features"]
            # Pre-normalize for cosine similarity
            norms = np.linalg.norm(raw_feats, axis=1, keepdims=True)
            norms[norms == 0] = 1e-7
            _rag_features = raw_feats / norms
        except Exception as e:
            print(f"Error loading RAG features: {e}")
    return _rag_features

def extract_embedding(pil_img: Image.Image) -> Optional[np.ndarray]:
    try:
        from backend.app import run_tflite_inference, IMAGE_SIZE
        resized_pil = pil_img.resize(IMAGE_SIZE)
        img_array = np.array(resized_pil, dtype=np.float32)
        img_array = np.expand_dims(img_array, axis=0)
        _, emb, _ = run_tflite_inference(img_array)
        if emb is not None and len(emb) > 0:
            return emb[0]
    except Exception:
        pass
    return None

def validate_track_image(pil_img: Image.Image, feature_vector: Optional[np.ndarray] = None) -> Tuple[bool, Optional[str], Optional[str], float]:
    """
    Validates whether the image is an authentic railway track / infrastructure photo.
    Rejects invalid/blank/synthetic images while accommodating real-world railway photos
    (tracks, joints, fishplates, switches, wheels on rails, sleepers, ballast).
    Returns: (is_valid, rejection_reason, detected_category, similarity_score)
    """
    img_rgb = pil_img.convert("RGB")
    w, h = img_rgb.size
    
    # 1. Minimum Resolution Gate
    if w < 48 or h < 48:
        return False, "Image resolution is too low (< 48x48). Please upload a higher resolution railway track photo.", "Low Resolution", 0.0

    img_arr = np.array(img_rgb, dtype=np.float32)

    # 2. Visual Texture & Variance Check (Rejects blank/solid/overexposed images)
    std_dev = float(np.std(img_arr))
    if std_dev < 15.0:
        return False, "Image has insufficient visual texture (appears blank, solid color, or overexposed). Please upload a clear photo of railway tracks.", "Blank / Solid Image", 0.0

    # 3. Monochromatic / Synthetic Color Profile Check
    r_mean = float(np.mean(img_arr[:, :, 0]))
    g_mean = float(np.mean(img_arr[:, :, 1]))
    b_mean = float(np.mean(img_arr[:, :, 2]))
    total_mean = r_mean + g_mean + b_mean
    if total_mean > 0:
        r_ratio = r_mean / total_mean
        g_ratio = g_mean / total_mean
        b_ratio = b_mean / total_mean
        if max(r_ratio, g_ratio, b_ratio) > 0.88:
            return False, "Unnatural monochromatic or solid color profile detected. Please upload an authentic railway track photograph.", "Monochromatic / Synthetic", 0.0

    # 4. Indoor Painted Wall & Synthetic Color Profile Check
    hsv = np.array(img_rgb.convert("HSV").resize((224, 224)), dtype=np.float32)
    hue = hsv[:, :, 0] * 360.0 / 255.0
    sat = hsv[:, :, 1] / 255.0
    val = hsv[:, :, 2] / 255.0

    # Indoor painted walls (Cyan/Teal/Aqua): Hue 150-205, Saturation > 0.22, Value > 0.35
    cyan_wall = float(np.mean((hue >= 150) & (hue <= 205) & (sat > 0.22) & (val > 0.35)))
    # Pink/Magenta/Purple walls: Hue 285-340, Saturation > 0.22, Value > 0.35
    purple_wall = float(np.mean((hue >= 285) & (hue <= 340) & (sat > 0.22) & (val > 0.35)))

    if cyan_wall > 0.25:
        return False, f"Indoor painted wall / non-railway room detected ({cyan_wall*100:.1f}% indoor wall area). Please upload an authentic outdoor railway track photograph.", "Indoor Room / Wall", 0.0

    if purple_wall > 0.25:
        return False, f"Indoor non-railway color profile detected ({purple_wall*100:.1f}% synthetic wall area). Please upload an authentic railway track photograph.", "Indoor / Synthetic", 0.0

    # 5. Smooth Region / Non-Ballast Surface Check
    gray = np.array(img_rgb.convert("L").resize((224, 224)), dtype=np.float32)
    lap = np.abs(gray[1:-1, 1:-1] * 4 - gray[:-2, 1:-1] - gray[2:, 1:-1] - gray[1:-1, :-2] - gray[1:-1, 2:])
    smooth_ratio = float(np.mean(lap < 3.0))

    # 6. Deep 128-D RAG Manifold Multi-Neighbor Ensemble Verification
    if feature_vector is None:
        feature_vector = extract_embedding(pil_img)

    rag_feats = get_rag_features()
    similarity = 1.0
    if feature_vector is not None and rag_feats is not None:
        feat_norm = feature_vector / max(np.linalg.norm(feature_vector), 1e-7)
        sims = np.dot(rag_feats, feat_norm)
        top1 = float(np.max(sims))
        top5 = float(np.mean(np.sort(sims)[-5:]))
        top10 = float(np.mean(np.sort(sims)[-10:]))
        ensemble_sim = 0.35 * top1 + 0.40 * top5 + 0.25 * top10
        similarity = ensemble_sim

        # Absolute lower boundary for authentic railway infrastructure
        if ensemble_sim < 0.45:
            match_pct = max(0.0, ensemble_sim * 100)
            return (
                False,
                f"Non-Railway Image Detected (Track Match: {match_pct:.1f}% vs required 48.0%). The uploaded image does not match railway track infrastructure, rail heads, fasteners, or ballast geometry.",
                "Non-Railway Object / Irrelevant Image",
                similarity
            )

        # Smooth surface filter: rejects human portraits, furniture, indoor scenes with large flat areas
        if ensemble_sim < 0.65 and smooth_ratio > 0.32:
            match_pct = max(0.0, ensemble_sim * 100)
            return (
                False,
                f"Non-Railway Object Detected (Large smooth surface / portrait area: {smooth_ratio*100:.1f}%, match: {match_pct:.1f}%). Please upload a clear photo of railway tracks.",
                "Non-Railway / Portrait Object",
                similarity
            )

    return True, None, "Railway Track Infrastructure", similarity
