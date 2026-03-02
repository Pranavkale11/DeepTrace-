"""
Autonomous Hostile Narrative & Coordination Intelligence Engine
================================================================
Endpoint: POST /api/youtube/autonomous-threat-scan

No query required. The system autonomously iterates over the internal
WATCHLIST_TOPICS, fetches videos + comments from YouTube, and runs:

  1. Cross-Video Coordination Detection  (existing engine)
  2. Hostile Narrative Detection         (new NarrativeDetectionService)

Final Threat Formula (normalised to [0,1]):
    final_risk = 0.4 × coordination_score + 0.6 × hostility_score

Rationale for 60/40 split:
    Hostile content is a direct signal; coordination amplifies reach but
    does not independently confirm intent. Hence hostility weighted higher.

Risk Levels:
    >= 0.70 → HIGH
    >= 0.40 → MEDIUM
     < 0.40 → LOW

Architecture:
  - Deduplication at video level (by video_id).
  - Deduplication at comment level (by comment_id).
  - Hard cap: ≤ 150 comments total.
  - All heavy computation offloaded to a thread (asyncio.to_thread).
  - Existing /api/youtube/analyze and /api/youtube/analyze-cross-video
    are completely untouched.
"""

import asyncio
import traceback
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, HTTPException

from services.youtube_service import get_youtube_service
from services.embedding_service import get_embedding_service
from services.narrative_detection_service import get_narrative_detection_service

router = APIRouter(prefix="/api/youtube", tags=["Autonomous Threat Scan"])


# ---------------------------------------------------------------------------
# Narrative Watchlist
# ---------------------------------------------------------------------------
# These topics drive autonomous data collection.
# Add or remove freely — no code change required elsewhere.
# Phrased neutrally as search queries, not as assertions.
# ---------------------------------------------------------------------------

WATCHLIST_TOPICS: List[str] = [
    "India government dictatorship",
    "India human rights abuse",
    "Boycott India",
    "India economic collapse",
    "India suppressing minorities",
    "India failed state narrative",
    "India state oppression",
    "India international sanctions",
]

# Max videos fetched per watchlist topic
MAX_VIDEOS_PER_TOPIC: int = 3

# Max comments per video during autonomous scan
MAX_COMMENTS_PER_VIDEO: int = 10

# Absolute cap on total comments to protect memory & latency
MAX_TOTAL_COMMENTS: int = 150

# Narrative-similarity threshold for coordination detection
COORDINATION_SIM_THRESHOLD: float = 0.70

# Weight mix for final risk score
WEIGHT_COORDINATION: float = 0.40
WEIGHT_HOSTILITY: float = 0.60


# ---------------------------------------------------------------------------
# Internal Cross-Video Signals (mirrors youtube.py logic — no duplication of
# business rules, just a local helper so we don't import from a sibling api/)
# ---------------------------------------------------------------------------

def _compute_cross_video_signals(
    posts: List[Dict[str, Any]],
    similar_pairs: List[Tuple[int, int, float]],
) -> Tuple[float, float, float, int]:
    """
    Math:
      D = (N² - Σnᵢ²) / 2            [cross-video pair denominator]
      narrative_sim  = cross_video_similar_pairs / D
      account_reuse  = accounts_on_>1_video / total_accounts
      temporal_burst = cross_video_pairs_within_30min / D
    """
    N = len(posts)
    if N < 2:
        return 0.0, 0.0, 0.0, 1 if N == 1 else 0

    video_counts: Dict[str, int] = defaultdict(int)
    for p in posts:
        video_counts[p["metadata"]["video_id"]] += 1

    sum_ni_sq = sum(c ** 2 for c in video_counts.values())
    D = float(N ** 2 - sum_ni_sq) / 2.0

    # Cross-video narrative similarity
    cv_sim_pairs = sum(
        1 for p1, p2, _ in similar_pairs
        if posts[p1]["metadata"]["video_id"] != posts[p2]["metadata"]["video_id"]
    )
    cv_sim_score = cv_sim_pairs / D if D > 0 else 0.0

    # Account reuse
    account_video_map: Dict[str, set] = defaultdict(set)
    for p in posts:
        account_video_map[p["account_id"]].add(p["metadata"]["video_id"])
    total_accounts = len(account_video_map)
    reused = sum(1 for vids in account_video_map.values() if len(vids) > 1)
    reuse_score = reused / total_accounts if total_accounts > 0 else 0.0

    # Temporal burst (30-min window across videos)
    sorted_posts = sorted(posts, key=lambda x: x["timestamp"])
    WINDOW = timedelta(minutes=30)
    burst_pairs = 0
    for i in range(N):
        for j in range(i + 1, N):
            if (sorted_posts[j]["timestamp"] - sorted_posts[i]["timestamp"]) > WINDOW:
                break
            if sorted_posts[i]["metadata"]["video_id"] != sorted_posts[j]["metadata"]["video_id"]:
                burst_pairs += 1
    burst_score = burst_pairs / D if D > 0 else 0.0

    return cv_sim_score, reuse_score, burst_score, len(video_counts)


def _get_risk_level(score: float) -> str:
    if score >= 0.70:
        return "HIGH"
    if score >= 0.40:
        return "MEDIUM"
    return "LOW"


def _build_explanation(
    total_comments: int,
    total_videos: int,
    hostility_score: float,
    coordination_score: float,
    risk_level: str,
    topics_scanned: int,
) -> str:
    """
    Produces a neutral, structured plain-English explanation of the analysis.
    All numbers are derived from mathematical signals, not editorial judgement.
    """
    lines = [
        f"Autonomous scan completed across {topics_scanned} watchlist topics.",
        f"Analyzed {total_comments} comments across {total_videos} unique videos.",
        f"{hostility_score:.1%} hostile narrative semantic similarity detected "
        f"(cosine similarity >= 0.65 against pattern library).",
        f"{coordination_score:.1%} cross-video coordination signal detected "
        f"(narrative similarity + account reuse + temporal burst).",
        f"Combined national narrative threat classified as {risk_level}.",
    ]
    return " ".join(lines)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/autonomous-threat-scan")
async def autonomous_threat_scan():
    """
    **Autonomous Hostile Narrative & Coordination Threat Scanner**

    No query parameter required. Internally iterates the WATCHLIST_TOPICS
    to collect YouTube comments, then runs:
    - Cross-Video Coordination Detection
    - Hostile Narrative Detection (semantic similarity against pattern library)

    Returns a fused Final Threat Score and explainable breakdown.
    """

    def _run_scan() -> Dict[str, Any]:
        youtube_svc = get_youtube_service()
        embed_svc   = get_embedding_service()
        narr_svc    = get_narrative_detection_service()

        # ------------------------------------------------------------------ #
        # PHASE 1 — Autonomous Data Collection with Deduplication
        # ------------------------------------------------------------------ #
        seen_video_ids: set = set()
        seen_comment_ids: set = set()

        all_posts: List[Dict[str, Any]] = []
        total_videos_found: int = 0
        topics_scanned: int = 0

        for topic in WATCHLIST_TOPICS:
            # Safety: stop collecting once we hit the comment hard cap
            if len(all_posts) >= MAX_TOTAL_COMMENTS:
                break

            try:
                videos = youtube_svc.fetch_videos(topic, max_results=MAX_VIDEOS_PER_TOPIC)
            except Exception as e:
                print(f"[AutonomousScan][WARN] fetch_videos failed for '{topic}': {e}")
                videos = []

            for video in videos:
                vid_id = video["video_id"]

                # Video-level deduplication
                if vid_id in seen_video_ids:
                    continue
                seen_video_ids.add(vid_id)
                total_videos_found += 1

                remaining_quota = MAX_TOTAL_COMMENTS - len(all_posts)
                if remaining_quota <= 0:
                    break

                try:
                    raw_comments = youtube_svc.fetch_comments(
                        vid_id,
                        max_results=min(MAX_COMMENTS_PER_VIDEO, remaining_quota),
                    )
                except Exception as e:
                    print(f"[AutonomousScan][WARN] fetch_comments failed for video '{vid_id}': {e}")
                    raw_comments = []

                for comment in raw_comments:
                    cid = comment.get("comment_id", "")
                    # Comment-level deduplication
                    if cid in seen_comment_ids:
                        continue
                    seen_comment_ids.add(cid)

                    try:
                        ts = datetime.fromisoformat(
                            comment["published_at"].replace("Z", "+00:00")
                        )
                    except Exception:
                        ts = datetime.now(timezone.utc)

                    all_posts.append({
                        "post_id":    f"yt_{cid}",
                        "content":    comment.get("content", ""),
                        "account_id": f"yt_acc_{comment.get('author_channel_id', 'unknown')}",
                        "timestamp":  ts,
                        "platform":   "youtube",
                        "metadata":   {"video_id": vid_id},
                    })

            topics_scanned += 1

        total_comments = len(all_posts)

        # ------------------------------------------------------------------ #
        # PHASE 2 — Cross-Video Coordination Score
        # ------------------------------------------------------------------ #
        coordination_score: float = 0.0
        cv_signals: Dict[str, float] = {
            "cross_video_similarity": 0.0,
            "account_reuse": 0.0,
            "temporal_burst": 0.0,
        }

        if total_comments >= 2:
            contents = [p["content"] for p in all_posts]
            similar_pairs = embed_svc.find_similar_pairs(
                contents, threshold=COORDINATION_SIM_THRESHOLD
            )
            sim_s, reuse_s, burst_s, _ = _compute_cross_video_signals(
                all_posts, similar_pairs
            )
            cv_signals = {
                "cross_video_similarity": round(sim_s, 4),
                "account_reuse":          round(reuse_s, 4),
                "temporal_burst":         round(burst_s, 4),
            }
            # Weighted combination matching the existing cross-video endpoint
            coordination_score = max(
                0.0, min(1.0, 0.40 * sim_s + 0.35 * reuse_s + 0.25 * burst_s)
            )

        # ------------------------------------------------------------------ #
        # PHASE 3 — Hostile Narrative Score
        # ------------------------------------------------------------------ #
        narrative_result = narr_svc.calculate_hostility_score(all_posts)
        hostility_score: float = narrative_result["hostility_score"]

        # ------------------------------------------------------------------ #
        # PHASE 4 — Fused Final Threat Score
        # ------------------------------------------------------------------ #
        # final_risk = 0.4 × coordination_score + 0.6 × hostility_score
        final_risk = max(
            0.0,
            min(
                1.0,
                WEIGHT_COORDINATION * coordination_score
                + WEIGHT_HOSTILITY * hostility_score,
            ),
        )
        risk_level = _get_risk_level(final_risk)

        # ------------------------------------------------------------------ #
        # PHASE 5 — Explainability
        # ------------------------------------------------------------------ #
        explanation = _build_explanation(
            total_comments=total_comments,
            total_videos=total_videos_found,
            hostility_score=hostility_score,
            coordination_score=coordination_score,
            risk_level=risk_level,
            topics_scanned=topics_scanned,
        )

        return {
            "success":                 True,
            "scan_id":                 f"auto_{uuid.uuid4().hex[:10]}",
            "scanned_at":              datetime.utcnow().isoformat() + "Z",
            "total_topics_scanned":    topics_scanned,
            "total_videos":            total_videos_found,
            "total_comments":          total_comments,
            # Coordination layer
            "coordination_score":      round(coordination_score, 4),
            "coordination_signals":    cv_signals,
            # Narrative layer
            "hostility_score":         round(hostility_score, 4),
            "hostile_comment_count":   narrative_result["hostile_comment_count"],
            "matched_hostile_examples": narrative_result["matched_examples"],
            # Fused threat
            "final_risk_score":        round(final_risk, 4),
            "risk_level":              risk_level,
            # Weight transparency
            "score_formula": {
                "coordination_weight": WEIGHT_COORDINATION,
                "hostility_weight":    WEIGHT_HOSTILITY,
                "formula": "final_risk = 0.4 × coordination_score + 0.6 × hostility_score",
            },
            "explanation": explanation,
            # Watchlist metadata for auditability
            "watchlist_topics_used": WATCHLIST_TOPICS,
        }

    # Offload all blocking I/O + CPU to a thread — keeps the event loop free
    try:
        result = await asyncio.to_thread(_run_scan)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Autonomous threat scan failed: {str(e)}",
        )
