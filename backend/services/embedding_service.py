"""
Embedding Service: High-performance semantic embeddings for production
Optimized for: CPU efficiency, memory stability, and O(n^2) scaling protection
"""

import hashlib
import threading
from typing import Dict, List, Tuple
from contextlib import nullcontext

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Lazy import for performance and memory optimization
try:
    import torch
    from sentence_transformers import SentenceTransformer
except ImportError:
    torch = None
    SentenceTransformer = None


class EmbeddingService:
    """Production-grade service for handling AI embeddings with resource safeguards"""

    MAX_POSTS_LIMIT = 1000  # Hard limit to prevent O(n^2) complexity crash

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the embedding model with strict CPU and No-Grad settings
        """
        print(f"[RELOAD] [Arch] Initializing EmbeddingService: {model_name}")
        self.device = "cpu"
        self.model = None
        self.embedding_cache: Dict[str, np.ndarray] = {}
        self.similarity_cache: Dict[str, List[Tuple[int, int, float]]] = {}

        try:
            if SentenceTransformer:
                # Force CPU mode for predictable hackathon performance
                self.model = SentenceTransformer(model_name, device=self.device)
                print(f"[OK] [Arch] Model loaded on {self.device.upper()}")
            else:
                print("[ERROR] [Arch] Critical: SentenceTransformer not installed")
        except Exception as e:
            print(f"[ERROR] [Arch] Critical: Failed to load model: {str(e)}")

    def _get_cache_key(self, text: str) -> str:
        """MD5 Hash for memory-efficient caching"""
        return hashlib.md5(text.encode()).hexdigest()

    def encode(self, texts: List[str], use_cache: bool = True) -> np.ndarray:
        """
        Convert texts to embeddings with memory-optimized torch.no_grad()
        """
        if not texts or self.model is None:
            return np.array([])

        # Data Scaling Protection
        if len(texts) > self.MAX_POSTS_LIMIT:
            print(f"[WARN] [Arch] Warning: Over-limit posts ({len(texts)}). Truncating to {self.MAX_POSTS_LIMIT} for stability.")
            texts = texts[:self.MAX_POSTS_LIMIT]

        # Component 1: Cache Retrieval
        cached_embeddings = {}
        uncached_texts = []
        uncached_indices = []

        for idx, text in enumerate(texts):
            key = self._get_cache_key(text)
            if use_cache and key in self.embedding_cache:
                cached_embeddings[idx] = self.embedding_cache[key]
            else:
                uncached_texts.append(text)
                uncached_indices.append(idx)

        # Component 2: Memory-Efficient Inference
        if uncached_texts:
            try:
                # Production Hardening: Disable gradients and use CPU
                with torch.no_grad() if torch else nullcontext():
                    new_embeddings = self.model.encode(
                        uncached_texts,
                        convert_to_numpy=True,
                        show_progress_bar=False,
                        batch_size=32  # Small batch size for cache-friendly CPU processing
                    )

                # Update Cache
                for text, embedding in zip(uncached_texts, new_embeddings):
                    key = self._get_cache_key(text)
                    self.embedding_cache[key] = embedding

                # Merge Results
                final_embeddings = [None] * len(texts)
                for idx, emb in cached_embeddings.items():
                    final_embeddings[idx] = emb
                for idx, emb in zip(uncached_indices, new_embeddings):
                    final_embeddings[idx] = emb

                return np.array(final_embeddings)
            except Exception as e:
                print(f"[ERROR] [Arch] Inference Failure: {str(e)}")
                # Return empty/zero vector fallback to prevent downstream crash
                return np.zeros((len(texts), 384))

        # Only cached results
        return np.array([cached_embeddings[i] for i in range(len(texts))])

    def find_similar_pairs(
        self,
        texts: List[str],
        threshold: float = 0.75
    ) -> List[Tuple[int, int, float]]:
        """
        Optimized similarity search with cluster-level caching
        """
        if (n := len(texts)) < 2:
            return []

        # Data Scaling Protection (O(n^2) safety)
        if n > self.MAX_POSTS_LIMIT:
            texts = texts[:self.MAX_POSTS_LIMIT]
            n = self.MAX_POSTS_LIMIT

        # Structural Caching
        texts_meta = "".join(sorted([self._get_cache_key(t) for t in texts]))
        texts_key = hashlib.md5(texts_meta.encode()).hexdigest()
        
        if texts_key in self.similarity_cache:
            return self.similarity_cache[texts_key]

        try:
            embeddings = self.encode(texts)
            if embeddings.size == 0:
                return []

            # Standard matrix computation is faster than iterative for our scale
            similarity_matrix = cosine_similarity(embeddings)
            
            # Efficient gathering
            similar_pairs = []
            for i in range(n):
                for j in range(i + 1, n):
                    score = float(similarity_matrix[i][j])
                    if score >= threshold:
                        similar_pairs.append((i, j, score))

            similar_pairs.sort(key=lambda x: x[2], reverse=True)
            self.similarity_cache[texts_key] = similar_pairs
            return similar_pairs
        except Exception as e:
            print(f"[ERROR] [Arch] Similarity Calculation Failure: {str(e)}")
            return []

    def clear_cache(self):
        """Emergency memory purge"""
        self.embedding_cache.clear()
        self.similarity_cache.clear()
        print("[OK] [Arch] Emergency cache purge complete")


# --- Thread-Safe Production Singleton ---
_singleton_instance: EmbeddingService = None
_instance_lock = threading.Lock()


def get_embedding_service() -> EmbeddingService:
    """Robust singleton access with thread-safe initialization"""
    global _singleton_instance
    if _singleton_instance is None:
        with _instance_lock:
            if _singleton_instance is None:
                _singleton_instance = EmbeddingService()
    return _singleton_instance
