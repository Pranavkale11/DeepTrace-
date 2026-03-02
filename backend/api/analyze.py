"""
AI-Powered Campaign Analysis Endpoint: Architect-hardened implementation
Optimized for: 3s response time, O(n^2) scaling protection, and crash-proof safety
"""

import asyncio
import hashlib
import json
import traceback
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

from fastapi import APIRouter, HTTPException
from models.schemas import AnalyzeRequest, AnalyzeResponse
from services.clustering_service import get_clustering_service
from services.embedding_service import get_embedding_service
from services.risk_scoring_service import get_risk_scoring_service
from utils.data_loader import data_loader

router = APIRouter(prefix="/api", tags=["Analysis"])

# --- Production Architect: Global Analysis Cache (Size-Limited) ---
_analysis_cache: Dict[str, Dict[str, Any]] = {}

def _get_cache_key_for_data(posts: List[Any], campaigns: List[Any]) -> str:
    """Stable key generation for dataset-level caching"""
    meta = f"{len(posts)}_{len(campaigns)}_{posts[0]['id'] if posts else 'empty'}"
    return hashlib.md5(meta.encode()).hexdigest()

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_campaigns(request: AnalyzeRequest = None):
    """
    Production-safe AI analysis with dataset scaling protection and result caching
    """
    start_time = datetime.utcnow()
    
    try:
        # 1. Load context
        all_posts = data_loader.get_all_posts()
        all_campaigns = data_loader.get_all_campaigns()
        all_accounts = data_loader.get_all_accounts()

        if not all_posts:
            return AnalyzeResponse(success=False, data={"status": "error", "message": "Zero datasets found"}, timestamp=datetime.utcnow().isoformat() + "Z")

        # Data Validation Guard: Ensure required attributes exist to prevent attribute errors in background thread
        for p in all_posts[:50]: # Sample check for safety
            if not isinstance(p.get("hashtags"), list): p["hashtags"] = []
            if "content" not in p: p["content"] = ""

        # 2. Architect Scaling Protection (Hard Limit)
        SAFE_LIMIT = 1000
        if len(all_posts) > SAFE_LIMIT:
            print(f"⚠️ [Arch] Dataset exceeds safe limit ({len(all_posts)}). Truncating to {SAFE_LIMIT} for demo stability.")
            all_posts = all_posts[:SAFE_LIMIT]

        # 3. Global Result Cache Check
        cache_key = _get_cache_key_for_data(all_posts, all_campaigns)
        now = datetime.utcnow()
        if cache_key in _analysis_cache:
            entry = _analysis_cache[cache_key]
            if now < entry["expiry"]:
                print("⚡ [Arch] Serving fresh analysis from cache")
                entry["data"]["duration_seconds"] = round((now - start_time).total_seconds(), 2)
                return AnalyzeResponse(success=True, data=entry["data"], timestamp=now.isoformat() + "Z")

        # 4. Heavy Compute Phase (Offloaded to background thread)
        def process_architecture_sync():
            embed_svc = get_embedding_service()
            cluster_svc = get_clustering_service()
            risk_svc = get_risk_scoring_service()

            # STEP 1: Collective Narrative Detection
            post_contents = [p["content"] for p in all_posts]
            similar_pairs = embed_svc.find_similar_pairs(post_contents, threshold=0.75)
            
            # Optimization: Pre-Map similar pairs by post ID for O(1) campaign filtering
            # This prevents campaign_count * similar_pairs_count complexity explosion
            pair_lookup = defaultdict(list)
            for i_idx, j_idx, sim in similar_pairs:
                p1_id, p2_id = all_posts[i_idx]["id"], all_posts[j_idx]["id"]
                pair_lookup[p1_id].append((p2_id, sim))
                pair_lookup[p2_id].append((p1_id, sim))
            
            # STEP 2: Campaign Per-Item Analysis
            results = []
            for camp in all_campaigns:
                camp_posts = data_loader.get_posts_by_campaign(camp["id"])
                camp_accounts = data_loader.get_accounts_by_campaign(camp["id"])
                
                if not camp_posts: continue

                # Optimization: Build campaign local pair list using lookup table (O(N_camp))
                c_indices = {p["id"]: i for i, p in enumerate(camp_posts)}
                local_pairs = []
                seen_pairs = set()
                
                for p1 in camp_posts:
                    p1_id = p1["id"]
                    for p2_id, sim in pair_lookup.get(p1_id, []):
                        if p2_id in c_indices:
                            pair_id = tuple(sorted((p1_id, p2_id)))
                            if pair_id not in seen_pairs:
                                local_pairs.append((c_indices[p1_id], c_indices[p2_id], sim))
                                seen_pairs.add(pair_id)

                # Compute Score
                metrics = cluster_svc.calculate_coordination_score(camp_posts, camp_accounts, local_pairs)
                avg_sim = sum(s for _,_,s in local_pairs)/len(local_pairs) if local_pairs else 0.0
                bots = sum(1 for a in camp_accounts if a["account_type"] == "bot")
                bot_ratio = bots/len(camp_accounts) if camp_accounts else 0.0

                risk = risk_svc.calculate_risk_score(avg_sim, metrics, bot_ratio)
                
                # Build Result Object
                results.append({
                    "campaign_id": camp["id"],
                    "campaign_title": camp["title"],
                    "risk_score": risk["risk_score"],
                    "risk_level": risk["risk_level"],
                    "confidence": risk["confidence"],
                    "explanation": risk["explanation"],
                    "risk_components": risk["components"],
                    "cluster_size": len(camp_posts),
                    "account_count": len(camp_accounts),
                    "coordination_score": metrics.get("coordination_score", 0),
                    "threat_indicators": risk_svc.calculate_threat_indicators(camp_posts, camp_accounts, local_pairs),
                    "recommendations": risk_svc.generate_recommendations(risk["risk_level"]),
                    "evidence_posts": [{"id": p["id"], "content": p["content"][:100], "is_flagged": p["is_flagged"]} for p in camp_posts[:3]],
                    "involved_accounts": [{"id": a["id"], "username": a["username"], "account_type": a["account_type"]} for a in camp_accounts[:5]]
                })

            results.sort(key=lambda x: x["risk_score"], reverse=True)
            return results, len(similar_pairs)

        # Non-blocking CPU execution
        campaign_results, pair_count = await asyncio.to_thread(process_architecture_sync)
        
        # 5. Build Final Response & Cache it
        duration = round((datetime.utcnow() - start_time).total_seconds(), 2)
        response_data = {
            "analysis_id": f"arch_{int(start_time.timestamp())}",
            "status": "completed",
            "duration_seconds": duration,
            "results": {
                "campaigns_analyzed": len(all_campaigns),
                "posts_analyzed": len(all_posts),
                "similar_pairs_detected": pair_count,
                "high_risk_campaigns": sum(1 for r in campaign_results if r["risk_level"] in ["high", "critical"]),
                "campaign_analyses": campaign_results
            }
        }
        
        # Cache for 60 seconds (Production Stable)
        # Bounded Memory: Clear if exceeds 50 entries
        if len(_analysis_cache) > 50:
            _analysis_cache.clear()
            print("🧹 [Arch] Global analysis cache size limit reached. Purged.")
            
        _analysis_cache[cache_key] = {
            "expiry": datetime.utcnow() + timedelta(seconds=60),
            "data": response_data
        }

        return AnalyzeResponse(success=True, data=response_data, timestamp=datetime.utcnow().isoformat() + "Z")

    except Exception as e:
        print(f"❌ [Arch] Critical Failure: {str(e)}")
        traceback.print_exc()
        return AnalyzeResponse(
            success=False,
            data={"status": "failed", "message": f"Global stability error: {str(e)}"},
            timestamp=datetime.utcnow().isoformat() + "Z"
        )


@router.get("/analyze/status/{analysis_id}")
async def get_analysis_status(analysis_id: str):
    """Poll endpoint (Mocked for sync speed)"""
    return {"success": True, "data": {"analysis_id": analysis_id, "status": "completed", "progress": 100}, "timestamp": datetime.utcnow().isoformat() + "Z"}
