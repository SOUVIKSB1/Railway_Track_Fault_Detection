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

    # 4. Structural Edge Gradient & Linear Texture Analysis
    gray = img_rgb.convert("L").resize((224, 224))
    g_arr = np.array(gray, dtype=np.float32)
    gx = np.zeros_like(g_arr)
    gy = np.zeros_like(g_arr)
    gx[:, 1:-1] = g_arr[:, 2:] - g_arr[:, :-2]
    gy[1:-1, :] = g_arr[2:, :] - g_arr[:-2, :]
    grad_mag = np.sqrt(gx**2 + gy**2)
    mean_grad = float(np.mean(grad_mag))
    strong_edges = float(np.mean(grad_mag > 28.0))

    # 5. Deep 128-D RAG Manifold Verification
    if feature_vector is None:
        feature_vector = extract_embedding(pil_img)

    rag_feats = get_rag_features()
    similarity = 1.0
    if feature_vector is not None and rag_feats is not None:
        feat_norm = feature_vector / max(np.linalg.norm(feature_vector), 1e-7)
        sims = np.dot(rag_feats, feat_norm)
        max_sim = float(np.max(sims))
        similarity = max_sim
        
        # Multi-Tier Semantic Boundary:
        # Tier A: If similarity < 0.48 -> Definite out-of-distribution non-railway image
        if similarity < 0.48:
            match_pct = max(0.0, similarity * 100)
            return (
                False,
                f"Non-Railway Image Detected (Semantic Match: {match_pct:.1f}% vs required 48.0%). The image does not contain railway tracks, rail heads, fasteners, or ballast infrastructure.",
                "Non-Railway Object / Irrelevant Image",
                similarity
            )
            
        # Tier B: If 0.48 <= similarity < 0.65 -> Must exhibit physical rail/ballast texture and edge density
        if similarity < 0.65:
            if mean_grad < 10.0 or strong_edges < 0.06:
                match_pct = max(0.0, similarity * 100)
                return (
                    False,
                    f"Non-Railway Object Detected (Semantic Match: {match_pct:.1f}%). The image lacks distinct railway steel rail edges and ballast texture.",
                    "Non-Railway Object / Smooth Surface",
                    similarity
                )

    return True, None, "Railway Track Infrastructure", similarity
