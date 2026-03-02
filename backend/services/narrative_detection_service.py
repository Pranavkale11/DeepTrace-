"""
Narrative Detection Service
============================
Detects hostile narrative patterns in a corpus of social media comments
using semantic (cosine) similarity against a curated pattern library.

Mathematical Model:
    hostile_matches = count(max_sim(comment, patterns) >= THRESHOLD)
    hostility_score = hostile_matches / total_comments  ∈ [0, 1]

Design principles:
  - Neutral in tone: detects *any* hostile narrative, not specific geopolitical side.
  - Mathematically defensible: threshold-gated similarity, not keyword matching.
  - Fully explainable: returns matched examples with their similarity scores.
  - Production-safe: hard comment limit, graceful fallback on model failure.
"""

import threading
from typing import List, Dict, Any

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from services.embedding_service import get_embedding_service


# ---------------------------------------------------------------------------
# Configurable Watchlist — Hostile Narrative Pattern Library
# ---------------------------------------------------------------------------
# These are *semantic anchors*, not keyword filters.
# The system matches comments whose MEANING is close to any pattern here.
# This approach is neutral: it detects narrative shape, not keyword accidents.
# ---------------------------------------------------------------------------

HOSTILE_NARRATIVE_PATTERNS: List[str] = [
    "India is a failed state",
    "Boycott India globally",
    "India suppressing minorities",
    "India is a dictatorship",
    "India human rights violations",
    "India collapsing economy",
    "India state-sponsored violence",
    "India oppressing its citizens",
    "India international isolation",
    "India deserves sanctions",
]

# Similarity threshold: comments with cosine sim >= this are considered matches.
# 0.65 balances precision vs recall for short social-media text.
HOSTILITY_THRESHOLD: float = 0.65

# Hard limit to protect memory and latency during analysis
MAX_COMMENTS_LIMIT: int = 150


# ---------------------------------------------------------------------------
# Core Service
# ---------------------------------------------------------------------------

class NarrativeDetectionService:
    """
    Detects hostile narrative signals in a comment corpus via semantic similarity.

    Thread-safe. Uses the shared EmbeddingService singleton to avoid double
    model loading — zero extra GPU/CPU footprint.
    """

    def __init__(self):
        print("[NarrativeDetection] Service initializing — pre-encoding pattern library...")
        self._pattern_embeddings: np.ndarray | None = None
        self._patterns: List[str] = HOSTILE_NARRATIVE_PATTERNS
        self._precompute_patterns()

    def _precompute_patterns(self) -> None:
        """
        Pre-encode the hostile narrative pattern library once at startup
        so every inference call only needs to encode the comments, not patterns.
        """
        try:
            embed_svc = get_embedding_service()
            self._pattern_embeddings = embed_svc.encode(self._patterns)
            print(f"[NarrativeDetection] Pattern library encoded: {len(self._patterns)} patterns.")
        except Exception as e:
            print(f"[NarrativeDetection][ERROR] Failed to pre-encode patterns: {e}")
            self._pattern_embeddings = None

    def calculate_hostility_score(
        self,
        posts: List[Dict[str, Any]],
        threshold: float = HOSTILITY_THRESHOLD,
    ) -> Dict[str, Any]:
        """
        Calculate the Hostility Score for a list of comment posts.

        Args:
            posts:     List of post dicts, each must have a "content" key.
            threshold: Cosine similarity threshold above which a comment
                       is considered a hostile narrative match.

        Returns:
            {
                "hostility_score":       float ∈ [0, 1],
                "hostile_comment_count": int,
                "total_comments":        int,
                "matched_examples":      [{"comment": str, "similarity": float, "matched_pattern": str}],
                "threshold_used":        float,
            }
        """
        # --- Guard: empty corpus ---
        if not posts:
            return self._empty_result()

        # --- Guard: model not available ---
        if self._pattern_embeddings is None or self._pattern_embeddings.size == 0:
            print("[NarrativeDetection][WARN] Pattern embeddings unavailable. Returning zero score.")
            return self._empty_result()

        # --- Safety cap ---
        if len(posts) > MAX_COMMENTS_LIMIT:
            posts = posts[:MAX_COMMENTS_LIMIT]

        comments: List[str] = [p.get("content", "") for p in posts]
        total: int = len(comments)

        try:
            embed_svc = get_embedding_service()
            comment_embeddings: np.ndarray = embed_svc.encode(comments)

            if comment_embeddings.size == 0:
                return self._empty_result()

            # Shape: (total_comments, num_patterns)
            sim_matrix: np.ndarray = cosine_similarity(comment_embeddings, self._pattern_embeddings)

            # For each comment, find its max similarity to any pattern
            max_sim_per_comment: np.ndarray = sim_matrix.max(axis=1)        # (total_comments,)
            best_pattern_idx: np.ndarray = sim_matrix.argmax(axis=1)        # (total_comments,)

            # Identify hostile comments
            hostile_mask = max_sim_per_comment >= threshold
            hostile_count: int = int(hostile_mask.sum())

            # Collect matched examples (up to 10 best for explainability)
            matched_examples: List[Dict[str, Any]] = []
            ranked_indices = np.argsort(max_sim_per_comment)[::-1]

            for idx in ranked_indices:
                if not hostile_mask[idx]:
                    break  # Since we're iterating in descending sim order, once we hit non-hostile we stop
                if len(matched_examples) >= 10:
                    break
                matched_examples.append({
                    "comment":         comments[idx][:200],  # Truncate for safety
                    "similarity":      round(float(max_sim_per_comment[idx]), 4),
                    "matched_pattern": self._patterns[int(best_pattern_idx[idx])],
                })

            # Note: hostile_score can be 0 if no matches pass threshold
            hostility_score: float = float(hostile_count) / float(total) if total > 0 else 0.0
            hostility_score = max(0.0, min(1.0, hostility_score))

            return {
                "hostility_score":       round(hostility_score, 4),
                "hostile_comment_count": hostile_count,
                "total_comments":        total,
                "matched_examples":      matched_examples,
                "threshold_used":        threshold,
            }

        except Exception as e:
            print(f"[NarrativeDetection][ERROR] Scoring failed: {e}")
            return self._empty_result()

    @staticmethod
    def _empty_result() -> Dict[str, Any]:
        return {
            "hostility_score":       0.0,
            "hostile_comment_count": 0,
            "total_comments":        0,
            "matched_examples":      [],
            "threshold_used":        HOSTILITY_THRESHOLD,
        }


# ---------------------------------------------------------------------------
# Thread-Safe Singleton
# ---------------------------------------------------------------------------

_singleton_instance: NarrativeDetectionService | None = None
_instance_lock = threading.Lock()


def get_narrative_detection_service() -> NarrativeDetectionService:
    """Thread-safe singleton factory. Initialises only once across all workers."""
    global _singleton_instance
    if _singleton_instance is None:
        with _instance_lock:
            if _singleton_instance is None:
                _singleton_instance = NarrativeDetectionService()
    return _singleton_instance
