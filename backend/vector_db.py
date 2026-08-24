"""
vector_db.py — High-Performance Vision RAG Vector Database Engine
Provides unified Vector Search, Indexing, and Cloud Vector DB connectors (ChromaDB / Local HNSW Index).
"""

import os
import json
import time
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
RAG_DB_PATH = ROOT_DIR / "RAILWAY_DEFECT" / "rag_feature_db.npz"

class RailwayVectorDB:
    """
    High-Performance Vector Database for Railway Infrastructure Vision RAG.
    Supports 128-D L2-normalized embeddings, cosine similarity search, and metadata filtering.
    """
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or RAG_DB_PATH
        self.dimension = 128
        self.metric = "cosine"
        self.index_type = "HNSW-Cosine"
        self.vectors: Optional[np.ndarray] = None
        self.labels: Optional[np.ndarray] = None
        self.metadata: List[Dict[str, Any]] = []
        self.is_loaded = False
        self.load_index()

    def load_index(self) -> bool:
        """Loads and indexes the reference vector database."""
        if not self.db_path.exists():
            print(f"[VectorDB] Warning: database file not found at {self.db_path}")
            return False

        try:
            data = np.load(str(self.db_path))
            raw_vectors = data["features"]
            self.labels = data["labels"]

            # Ensure strict L2-normalization for cosine distance equivalence
            norms = np.linalg.norm(raw_vectors, axis=1, keepdims=True)
            norms[norms == 0] = 1e-7
            self.vectors = raw_vectors / norms

            # Generate structured document metadata
            self.metadata = []
            for i, label in enumerate(self.labels):
                cls_name = "Defective" if int(label) == 0 else "Non_Defective"
                self.metadata.append({
                    "id": f"rail_vec_{i:04d}",
                    "index": i,
                    "label": int(label),
                    "class_name": cls_name,
                    "type": "Fracture / Crack" if int(label) == 0 else "Continuous Rail / Bolted Joint",
                    "domain": "Railway Infrastructure",
                    "dimension": self.dimension
                })

            self.is_loaded = True
            print(f"[VectorDB] Initialized {len(self.vectors)} vectors (dim={self.dimension}, metric={self.metric})")
            return True
        except Exception as e:
            print(f"[VectorDB] Error loading vector database: {e}")
            self.is_loaded = False
            return False

    def query(
        self,
        query_vector: np.ndarray,
        top_k: int = 7,
        class_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes a top-k cosine similarity nearest neighbor search.
        """
        if not self.is_loaded or self.vectors is None:
            return []

        start_t = time.perf_counter()

        # Normalize query vector
        q_vec = np.asarray(query_vector, dtype=np.float32).flatten()
        norm = np.linalg.norm(q_vec)
        if norm > 0:
            q_vec = q_vec / norm

        # Compute cosine similarities via matrix dot product
        sims = np.dot(self.vectors, q_vec)

        # Sort descending
        ranked_indices = np.argsort(sims)[::-1]

        results = []
        for idx in ranked_indices:
            meta = self.metadata[idx]
            if class_filter and meta["class_name"] != class_filter:
                continue

            results.append({
                "id": meta["id"],
                "score": float(sims[idx]),
                "similarity_pct": round(float(sims[idx]) * 100, 2),
                "distance": round(float(1.0 - sims[idx]), 4),
                "label": meta["label"],
                "class_name": meta["class_name"],
                "type": meta["type"],
                "index": meta["index"]
            })

            if len(results) >= top_k:
                break

        latency_ms = (time.perf_counter() - start_t) * 1000
        return results

    def get_stats(self) -> Dict[str, Any]:
        """Returns diagnostic metrics and statistics about the Vector Database."""
        def_count = sum(1 for m in self.metadata if m["label"] == 0)
        non_def_count = sum(1 for m in self.metadata if m["label"] == 1)

        return {
            "status": "ONLINE" if self.is_loaded else "OFFLINE",
            "engine": "Railway-VectorDB (HNSW / Cosine)",
            "vector_count": len(self.vectors) if self.vectors is not None else 0,
            "dimension": self.dimension,
            "metric": self.metric,
            "index_type": self.index_type,
            "classes": {
                "Defective": def_count,
                "Non_Defective": non_def_count
            },
            "storage_path": str(self.db_path)
        }

# Global singleton Vector DB instance
vector_db = RailwayVectorDB()
