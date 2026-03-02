from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
import math

from models.schemas import StandardResponse, ErrorResponse
from utils.data_loader import data_loader

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])


@router.get("")
async def get_campaigns(
    status: Optional[str] = Query("all", description="Filter by status"),
    threat_level: Optional[str] = Query("all", description="Filter by threat level"),
    campaign_type: Optional[str] = Query("all", description="Filter by campaign type"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("detected_at", description="Sort field"),
    order: str = Query("desc", description="Sort order (asc/desc)"),
    include_geo: bool = Query(False, description="Include geographic intelligence data")
):
    """Get list of campaigns with filtering and pagination"""
    
    # Filter campaigns
    campaigns = data_loader.filter_campaigns(
        status=status,
        threat_level=threat_level,
        campaign_type=campaign_type
    )
    
    # Process campaigns to optionally include/exclude geo data
    processed_campaigns = []
    for c in campaigns:
        cp = c.copy()
        if not include_geo:
            cp.pop("locations", None)
            cp.pop("growth", None)
        processed_campaigns.append(cp)
    
    campaigns = processed_campaigns
    
    # Sort campaigns
    reverse = (order == "desc")
    if sort_by in ["detected_at", "last_activity", "created_at", "updated_at"]:
        campaigns.sort(key=lambda x: x.get(sort_by, ""), reverse=reverse)
    elif sort_by in ["total_posts", "total_accounts", "confidence_score"]:
        campaigns.sort(key=lambda x: x.get(sort_by, 0), reverse=reverse)
    
    # Pagination
    total_items = len(campaigns)
    total_pages = math.ceil(total_items / limit) if total_items > 0 else 1
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_campaigns = campaigns[start_idx:end_idx]
    
    return StandardResponse(
        success=True,
        data={
            "campaigns": paginated_campaigns,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_items": total_items,
                "items_per_page": limit,
                "has_next": page < total_pages,
                "has_previous": page > 1
            }
        },
        timestamp=datetime.utcnow().isoformat() + "Z"
    )


@router.get("/{campaign_id}")
async def get_campaign_detail(campaign_id: str):
    """Get detailed information about a specific campaign with AI-powered threat analysis"""
    
    # Import AI services
    from services.embedding_service import get_embedding_service
    from services.clustering_service import get_clustering_service
    from services.risk_scoring_service import get_risk_scoring_service
    
    # Get campaign
    campaign = data_loader.get_campaign_by_id(campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=404,
            detail=f"Campaign with ID '{campaign_id}' not found"
        )
    
    # Get posts and accounts for this campaign
    posts = data_loader.get_posts_by_campaign(campaign_id)
    accounts = data_loader.get_accounts_by_campaign(campaign_id)
    
    # ==========================================
    # AI-Powered Threat Analysis
    # ==========================================
    if posts and accounts:
        # Initialize services
        embedding_service = get_embedding_service()
        clustering_service = get_clustering_service()
        risk_scoring_service = get_risk_scoring_service()
        
        # Extract post contents
        post_contents = [post["content"] for post in posts]
        
        # Find similar posts
        similar_pairs = embedding_service.find_similar_pairs(
            post_contents,
            threshold=0.75
        )
        
        # Calculate coordination metrics
        coordination_metrics = clustering_service.calculate_coordination_score(
            posts=posts,
            accounts=accounts,
            similar_pairs=similar_pairs
        )
        
        # Calculate average narrative similarity
        avg_similarity = 0.0
        if similar_pairs:
            avg_similarity = sum(sim for _, _, sim in similar_pairs) / len(similar_pairs)
        
        # Calculate bot involvement
        bot_count = sum(1 for acc in accounts if acc["account_type"] == "bot")
        bot_involvement = bot_count / len(accounts) if accounts else 0
        
        # Calculate risk score
        risk_analysis = risk_scoring_service.calculate_risk_score(
            narrative_similarity=avg_similarity,
            coordination_metrics=coordination_metrics,
            bot_involvement=bot_involvement
        )
        
        # Generate threat indicators
        threat_indicators = risk_scoring_service.calculate_threat_indicators(
            posts=posts,
            accounts=accounts,
            similar_pairs=similar_pairs
        )
        
        # Get recommendations
        recommendations = risk_scoring_service.generate_recommendations(
            risk_level=risk_analysis["risk_level"]
        )
        
        # Build AI-powered threat analysis
        threat_analysis = {
            "campaign_id": campaign_id,
            "threat_score": risk_analysis["risk_score"] * 100,  # Scale to 0-100
            "risk_level": risk_analysis["risk_level"],
            "confidence": risk_analysis["confidence"],
            "indicators": threat_indicators,
            "narrative_analysis": risk_analysis["explanation"],
            "recommendations": recommendations,
            "coordination_metrics": {
                "coordination_score": coordination_metrics["coordination_score"],
                "cluster_density": coordination_metrics["cluster_density"],
                "hashtag_overlap": coordination_metrics["hashtag_overlap"],
                "temporal_coordination": coordination_metrics["temporal_coordination"],
                "bot_involvement": coordination_metrics["bot_involvement"]
            },
            "similar_content_pairs": len(similar_pairs)
        }
    else:
        # Fallback to mock data if no posts/accounts
        threat_analysis = data_loader.get_threat_score_by_campaign(campaign_id)
    
    # Calculate top hashtags
    hashtag_counts = {}
    for post in posts:
        for tag in post.get("hashtags", []):
            hashtag_counts[tag] = hashtag_counts.get(tag, 0) + 1
    
    top_hashtags = [
        {"tag": tag, "count": count}
        for tag, count in sorted(hashtag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]
    
    # Calculate platform breakdown
    platform_counts = {}
    for post in posts:
        platform = post.get("platform", "other")
        platform_counts[platform] = platform_counts.get(platform, 0) + 1
    
    total_posts = len(posts)
    platform_breakdown = [
        {
            "platform": platform,
            "post_count": count,
            "percentage": round((count / total_posts * 100), 1) if total_posts > 0 else 0
        }
        for platform, count in platform_counts.items()
    ]
    
    # Generate real timeline from actual post timestamps
    from collections import defaultdict
    timeline_data = defaultdict(int)
    
    for post in posts:
        # Extract hour from timestamp
        posted_at = post.get("posted_at", "")
        if posted_at:
            # Simple hour extraction (would use proper datetime in production)
            hour = posted_at[:13] + ":00:00Z"  # Truncate to hour
            timeline_data[hour] += 1
    
    # Convert to sorted list
    timeline = [
        {"date": hour, "post_count": count}
        for hour, count in sorted(timeline_data.items())
    ]
    
    # If no timeline data, use default
    if not timeline:
        timeline = [
            {"date": "2026-02-04T10:00:00Z", "post_count": 15},
            {"date": "2026-02-04T11:00:00Z", "post_count": 89},
            {"date": "2026-02-04T12:00:00Z", "post_count": 67},
        ]
    
    # Build response
    campaign_detail = campaign.copy()
    
    return StandardResponse(
        success=True,
        data={
            "campaign": campaign_detail,
            "threat_analysis": threat_analysis,
            "top_hashtags": top_hashtags,
            "platform_breakdown": platform_breakdown,
            "timeline": timeline
        },
        timestamp=datetime.utcnow().isoformat() + "Z"
    )


@router.get("/{campaign_id}/posts")
async def get_campaign_posts(
    campaign_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("posted_at", description="Sort field")
):
    """Get all posts for a specific campaign"""
    
    # Verify campaign exists
    campaign = data_loader.get_campaign_by_id(campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=404,
            detail=f"Campaign with ID '{campaign_id}' not found"
        )
    
    # Get posts
    posts = data_loader.get_posts_by_campaign(campaign_id)
    
    # Sort posts
    if sort_by == "posted_at":
        posts.sort(key=lambda x: x.get("posted_at", ""), reverse=True)
    elif sort_by == "engagement_count":
        posts.sort(key=lambda x: x.get("engagement_count", 0), reverse=True)
    
    # Add account usernames to posts
    enriched_posts = []
    for post in posts:
        account = data_loader.get_account_by_id(post["account_id"])
        post_copy = post.copy()
        post_copy["account_username"] = account["username"] if account else "Unknown"
        enriched_posts.append(post_copy)
    
    # Pagination
    total_items = len(enriched_posts)
    total_pages = math.ceil(total_items / limit) if total_items > 0 else 1
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_posts = enriched_posts[start_idx:end_idx]
    
    return StandardResponse(
        success=True,
        data={
            "campaign_id": campaign_id,
            "campaign_title": campaign["title"],
            "posts": paginated_posts,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_items": total_items,
                "items_per_page": limit,
                "has_next": page < total_pages,
                "has_previous": page > 1
            }
        },
        timestamp=datetime.utcnow().isoformat() + "Z"
    )


@router.get("/{campaign_id}/accounts")
async def get_campaign_accounts(campaign_id: str):
    """Get all accounts involved in a specific campaign"""
    
    # Verify campaign exists
    campaign = data_loader.get_campaign_by_id(campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=404,
            detail=f"Campaign with ID '{campaign_id}' not found"
        )
    
    # Get accounts
    accounts = data_loader.get_accounts_by_campaign(campaign_id)
    
    # Calculate bot percentage
    bot_count = sum(1 for acc in accounts if acc["account_type"] == "bot")
    bot_percentage = round((bot_count / len(accounts) * 100), 1) if accounts else 0
    
    # Generate network graph (simplified)
    nodes = [
        {
            "id": acc["id"],
            "label": acc["username"],
            "type": acc["account_type"],
            "size": acc.get("post_count_in_campaign", 1)
        }
        for acc in accounts[:20]  # Limit to first 20 for performance
    ]
    
    # Create some mock edges (connections between accounts)
    edges = []
    for i in range(min(len(nodes) - 1, 10)):
        edges.append({
            "source": nodes[i]["id"],
            "target": nodes[i + 1]["id"],
            "weight": 5
        })
    
    return StandardResponse(
        success=True,
        data={
            "campaign_id": campaign_id,
            "campaign_title": campaign["title"],
            "total_accounts": len(accounts),
            "bot_percentage": bot_percentage,
            "accounts": accounts,
            "network_graph": {
                "nodes": nodes,
                "edges": edges
            }
        },
        timestamp=datetime.utcnow().isoformat() + "Z"
    )
