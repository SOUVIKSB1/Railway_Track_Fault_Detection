"""
domain_validator.py — Multi-Tier RAG Database & Geometric Domain Validator
Uses 128-D RAG feature database retrieval to validate authentic railway infrastructure.
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
            _rag_features = data["features"]
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
    Validates whether the image is a legitimate railway track photo.
    Returns: (is_valid, rejection_reason, detected_category, similarity_score)
    """
    if feature_vector is None:
        feature_vector = extract_embedding(pil_img)

    img_rgb = pil_img.convert("RGB")
    w, h = img_rgb.size
    
    # 1. Minimum Resolution Gate
    if w < 64 or h < 64:
        return False, "Image resolution is too low (< 64x64). Please upload a higher resolution photo.", "Low Resolution", 0.0

    img_arr = np.array(img_rgb, dtype=np.float32)

    # 2. Visual Texture & Variance Check (Rejects blank/solid/overexposed images)
    std_dev = float(np.std(img_arr))
    if std_dev < 18.0:
        return False, "Image has insufficient visual texture (appears blank, solid color, or overexposed). Please upload a clear photo of railway tracks.", "Blank / Solid Image", 0.0

    # 3. Monochromatic / Synthetic Color Check
    r_mean, g_mean, b_mean = np.mean(img_arr[:, :, 0]), np.mean(img_arr[:, :, 1]), np.mean(img_arr[:, :, 2])
    total_mean = r_mean + g_mean + b_mean
    if total_mean > 0:
        r_ratio = r_mean / total_mean
        g_ratio = g_mean / total_mean
        b_ratio = b_mean / total_mean
        if r_ratio > 0.85 or g_ratio > 0.85 or b_ratio > 0.85:
            return False, "Unnatural monochromatic or synthetic color profile detected. Please upload an authentic railway track photo.", "Monochromatic / Synthetic", 0.0

    # 4. RAG Feature Database Cosine Similarity Verification (128-D Manifold)
    rag_feats = get_rag_features()
    similarity = 1.0
    if feature_vector is not None and rag_feats is not None:
        feat_norm = feature_vector / max(np.linalg.norm(feature_vector), 1e-7)
        sims = np.dot(rag_feats, feat_norm)
        max_sim = float(np.max(sims))
        similarity = max_sim
        
        # Authentic railway tracks/joints have max similarity >= 0.40 (up to 0.95)
        # Non-railway images (people, faces, cars, animals, rooms, food) have max similarity <= 0.28
        MIN_RAILWAY_SIMILARITY = 0.35
        
        if similarity < MIN_RAILWAY_SIMILARITY:
            match_pct = max(0.0, similarity * 100)
            return (
                False,
                f"Non-Railway Image Detected (Track Semantic Match: {match_pct:.1f}%). The uploaded image does not match the structural geometry of railway tracks, rail fasteners, or track ballast.",
                "Non-Railway Object / Portrait / Irrelevant Image",
                similarity
            )

    return True, None, "Railway Track Infrastructure", similarity
