from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import asyncio
import uuid
import traceback
from collections import defaultdict

from services.youtube_service import get_youtube_service
from services.embedding_service import get_embedding_service
from services.clustering_service import get_clustering_service
from services.risk_scoring_service import get_risk_scoring_service

router = APIRouter(prefix="/api/youtube", tags=["YouTube Analysis"])

# --- Defensible Cross-Video Coordination Logic ---

def _compute_cross_video_signals(posts: List[Dict[str, Any]], similar_pairs: List[Any]) -> tuple[float, float, float, int]:
    """
    Computes coordination signals focusing on interaction across different videos.
    
    Math Formula:
    - Denominator (D) = Total pairs between different videos = (N^2 - sum(ni^2)) / 2
    - Narrative Similarity = Cross-Video Similar Pairs / D
    - Account Reuse = Unique Accounts on >1 Video / Total Unique Accounts
    - Temporal Burst = Cross-Video Timestamps within 30m / D
    """
    N = len(posts)
    if N < 2:
        return 0.0, 0.0, 0.0, 1 if N == 1 else 0

    # 1. Denominator: Total possible pairs between DIFFERENT videos
    video_counts = defaultdict(int)
    for p in posts:
        video_counts[p["metadata"]["video_id"]] += 1
    
    sum_ni_sq = sum(count**2 for count in video_counts.values())
    total_possible_cross_pairs = float(N**2 - sum_ni_sq) / 2.0
    
    # 2. Cross-Video Narrative Similarity
    cross_video_sim_pairs = 0
    for p1_idx, p2_idx, _ in similar_pairs:
        if posts[p1_idx]["metadata"]["video_id"] != posts[p2_idx]["metadata"]["video_id"]:
            cross_video_sim_pairs += 1
            
    cv_similarity_score = float(cross_video_sim_pairs) / total_possible_cross_pairs if total_possible_cross_pairs > 0 else 0.0

    # 3. Account Reuse Across Videos
    unique_accounts = set()
    account_video_map = defaultdict(set)
    for p in posts:
        acc_id = p["account_id"]
        unique_accounts.add(acc_id)
        account_video_map[acc_id].add(p["metadata"]["video_id"])
    
    reused_accounts_count = sum(1 for acc_id in unique_accounts if len(account_video_map[acc_id]) > 1)
    acc_reuse_score = float(reused_accounts_count) / float(len(unique_accounts)) if unique_accounts else 0.0

    # 4. Temporal Burst Across Videos
    # Complexity: O(N * k) where k is the number of posts in the 30-minute window
    sorted_posts = sorted(posts, key=lambda x: x["timestamp"])
    burst_pairs = 0
    WINDOW = timedelta(minutes=30)
    
    for i in range(N):
        for j in range(i + 1, N):
            # Window pruning: since sorted, break when time delta exceeds WINDOW
            if (sorted_posts[j]["timestamp"] - sorted_posts[i]["timestamp"]) > WINDOW:
                break
            # Increment if posts belong to different videos
            if sorted_posts[i]["metadata"]["video_id"] != sorted_posts[j]["metadata"]["video_id"]:
                burst_pairs += 1
                
    temporal_burst_score = float(burst_pairs) / total_possible_cross_pairs if total_possible_cross_pairs > 0 else 0.0
    
    return cv_similarity_score, acc_reuse_score, temporal_burst_score, len(video_counts)

def _get_risk_level(score: float) -> str:
    if score >= 0.7: return "high"
    if score >= 0.4: return "medium"
    return "low"

def _generate_explanation(sim, reuse, burst, total_comments, total_videos, risk_level):
    """Structured and professional explanation generator"""
    header = f"Analyzed {total_comments} comments across {total_videos} videos."
    
    metrics = []
    metrics.append(f"{sim:.1%} cross-video narrative similarity detected.")
    metrics.append(f"{reuse:.1%} of accounts posted across multiple videos.")
    if burst > 0:
        metrics.append(f"Temporal synchronization signal: {burst:.1%}.")
    
    footer = f"Overall coordination risk classified as {risk_level.upper()}."
    
    return f"{header} {' '.join(metrics)} {footer}"

# --- Existing Endpoints (Kept for compatibility) ---

@router.post("/analyze")
async def analyze_youtube_campaign(
    query: str = Body(..., embed=True),
    max_videos: int = Body(5, embed=True),
    max_comments_per_video: int = Body(20, embed=True)
):
    """
    Standard analysis: treats search results as isolated clusters.
    """
    youtube_svc = get_youtube_service()
    try:
        videos = youtube_svc.fetch_videos(query, max_results=max_videos)
        if not videos:
            return {"success": True, "source": "youtube", "total_comments_analyzed": 0, "campaign_analyses": []}

        all_raw_comments = []
        for video in videos:
            all_raw_comments.extend(youtube_svc.fetch_comments(video["video_id"], max_results=max_comments_per_video))

        if not all_raw_comments:
            return {"success": True, "source": "youtube", "total_comments_analyzed": 0, "campaign_analyses": []}

        posts = []
        accounts_map = {}
        for comment in all_raw_comments:
            post_id = f"yt_{comment['comment_id']}"
            author_id = f"yt_acc_{comment['author_channel_id']}"
            try:
                dt_obj = datetime.fromisoformat(comment["published_at"].replace('Z', '+00:00'))
            except:
                dt_obj = datetime.now(timezone.utc)
            
            p = {
                "id": post_id, "post_id": post_id, "content": comment["content"],
                "account_id": author_id, "timestamp": dt_obj, "posted_at": comment["published_at"],
                "platform": "youtube", "hashtags": [], "is_flagged": False,
                "metadata": {"video_id": comment["video_id"], "like_count": comment["like_count"]}
            }
            posts.append(p)
            if author_id not in accounts_map:
                accounts_map[author_id] = {"id": author_id, "username": comment["author_name"], "account_type": "human", "bot_probability": 0.1, "platform": "youtube"}

        def run_analysis():
            embed_svc = get_embedding_service()
            cluster_svc = get_clustering_service()
            risk_svc = get_risk_scoring_service()
            contents = [p["content"] for p in posts]
            similar_pairs = embed_svc.find_similar_pairs(contents, threshold=0.75)
            graph = cluster_svc.build_campaign_graph(posts, list(accounts_map.values()))
            communities = cluster_svc.detect_communities(graph)
            
            campaign_results = []
            significant = [c for c in communities if len(c) >= 3] or [set([p["id"] for p in posts])]
            
            for i, community_ids in enumerate(significant):
                camp_posts = [p for p in posts if p["id"] in community_ids]
                involved_actors = set(p["account_id"] for p in camp_posts)
                camp_accounts = [a for a in accounts_map.values() if a["id"] in involved_actors]
                if not camp_posts: continue

                p_idx = {p["id"]: idx for idx, p in enumerate(camp_posts)}
                local_pairs = [(p_idx[posts[p1]["id"]], p_idx[posts[p2]["id"]], s) for p1, p2, s in similar_pairs if posts[p1]["id"] in community_ids and posts[p2]["id"] in community_ids]
                
                metrics = cluster_svc.calculate_coordination_score(camp_posts, camp_accounts)
                avg_sim = sum(s for _, _, s in local_pairs) / len(local_pairs) if local_pairs else 0.0
                risk_data = risk_svc.calculate_risk_score(avg_sim, metrics, 0.1)
                
                campaign_results.append({
                    "campaign_id": f"yt_campaign_{i}_{uuid.uuid4().hex[:6]}",
                    "campaign_title": f"YouTube Cluster: {query[:20]}",
                    "risk_score": risk_data["risk_score"], "risk_level": risk_data["risk_level"],
                    "explanation": risk_data["explanation"], "cluster_size": len(camp_posts)
                })
            return sorted(campaign_results, key=lambda x: x["risk_score"], reverse=True)

        campaign_analyses = await asyncio.to_thread(run_analysis)
        return {"success": True, "source": "youtube", "total_comments_analyzed": len(all_raw_comments), "campaign_analyses": campaign_analyses}
    except Exception as e:
        traceback.print_exc()
        return {"success": False, "error": "analysis_failed", "message": str(e)}

# --- New Defensible Cross-Video Analysis Endpoint ---

@router.post("/analyze-cross-video")
async def analyze_youtube_cross_video(
    query: str = Body(..., embed=True),
    max_videos: int = Body(5, embed=True),
    max_comments_per_video: int = Body(20, embed=True)
):
    """
    REBUILT: Defensible cross-video coordination detection.
    Computes normalized similarity, account reuse, and temporal bursts.
    """
    MAX_POSTS_LIMIT = 100
    youtube_svc = get_youtube_service()
    
    try:
        # 1. Data Collection
        videos = youtube_svc.fetch_videos(query, max_results=max_videos)
        if not videos:
            return {"success": True, "source": "youtube", "total_videos_scanned": 0, "total_comments_analyzed": 0, "risk_score": 0.0, "risk_level": "low", "explanation": "No videos found."}

        raw_comments = []
        for video in videos:
            raw_comments.extend(youtube_svc.fetch_comments(video["video_id"], max_results=max_comments_per_video))
        
        # 2. Enforce Hard Limit for stability
        if len(raw_comments) > MAX_POSTS_LIMIT:
            raw_comments = raw_comments[:MAX_POSTS_LIMIT]

        if not raw_comments:
            return {"success": True, "source": "youtube", "total_videos_scanned": len(videos), "total_comments_analyzed": 0, "risk_score": 0.0, "risk_level": "low", "explanation": "No comments found."}

        # 3. Standardization
        posts = []
        for comment in raw_comments:
            try:
                # Ensure timezone-aware UTC directly
                ts = datetime.fromisoformat(comment["published_at"].replace('Z', '+00:00'))
            except:
                ts = datetime.now(timezone.utc)
            
            posts.append({
                "post_id": f"yt_{comment['comment_id']}",
                "content": comment["content"],
                "account_id": f"yt_acc_{comment['author_channel_id']}",
                "timestamp": ts,
                "platform": "youtube",
                "metadata": {"video_id": comment["video_id"]}
            })

        # 4. Offloaded Analysis Phase
        def perform_defensible_analysis():
            embed_svc = get_embedding_service()
            
            # Step A: Narrative Similarity (YouTube specific threshold for short comments)
            contents = [p["content"] for p in posts]
            similar_pairs = embed_svc.find_similar_pairs(contents, threshold=0.70)
            
            # Step B: Compute Three Signals
            sim_score, reuse_score, burst_score, video_count = _compute_cross_video_signals(posts, similar_pairs)
            
            # Step C: Final Defensible Risk Score
            # Weights: 0.4 narrative, 0.35 reuse, 0.25 temporal
            unclamped_score = (0.4 * sim_score) + (0.35 * reuse_score) + (0.25 * burst_score)
            risk_score = max(0.0, min(1.0, unclamped_score))
            risk_level = _get_risk_level(risk_score)
            
            return {
                "risk_score": round(risk_score, 3),
                "risk_level": risk_level,
                "signals": {
                    "cross_video_similarity": round(sim_score, 3),
                    "account_reuse": round(reuse_score, 3),
                    "temporal_burst": round(burst_score, 3)
                },
                "total_videos": video_count,
                "explanation": _generate_explanation(sim_score, reuse_score, burst_score, len(posts), video_count, risk_level)
            }

        result = await asyncio.to_thread(perform_defensible_analysis)

        return {
            "success": True,
            "source": "youtube",
            "total_videos_scanned": result["total_videos"],
            "total_comments_analyzed": len(posts),
            "risk_score": result["risk_score"],
            "risk_level": result["risk_level"],
            "signals": result["signals"],
            "explanation": result["explanation"]
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
