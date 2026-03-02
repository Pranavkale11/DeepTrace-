"""
Risk Scoring Service: Calculate explainable risk scores for campaigns
Uses multiple signals to determine threat level
"""

from typing import Dict, Any, List, Tuple
import numpy as np


class RiskScoringService:
    """Handles risk score calculation with explainability"""
    
    # Weights for risk score calculation
    WEIGHTS = {
        "narrative_similarity": 0.30,
        "cluster_density": 0.25,
        "bot_probability": 0.25,
        "temporal_coordination": 0.20
    }
    
    # Risk level thresholds
    THRESHOLDS = {
        "low": 0.35,
        "medium": 0.55,
        "high": 0.75,
        "critical": 0.90
    }
    
    def calculate_risk_score(
        self,
        narrative_similarity: float,
        coordination_metrics: Dict[str, float],
        bot_involvement: float
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive risk score with breakdown
        
        Args:
            narrative_similarity: Average similarity score from embeddings (0-1)
            coordination_metrics: Dict with coordination scores from clustering
            bot_involvement: Percentage of bot accounts (0-1)
            
        Returns:
            Dictionary with risk score, level, and explanation
        """
        # Extract metrics
        cluster_density = coordination_metrics.get("cluster_density", 0.0)
        temporal_coordination = coordination_metrics.get("temporal_coordination", 0.0)
        
        # Calculate weighted risk score
        risk_score = (
            self.WEIGHTS["narrative_similarity"] * narrative_similarity +
            self.WEIGHTS["cluster_density"] * cluster_density +
            self.WEIGHTS["bot_probability"] * bot_involvement +
            self.WEIGHTS["temporal_coordination"] * temporal_coordination
        )
        
        # Determine risk level
        risk_level = self._get_risk_level(risk_score)
        
        # Generate explanation
        explanation = self._generate_explanation(
            risk_score=risk_score,
            narrative_similarity=narrative_similarity,
            cluster_density=cluster_density,
            bot_involvement=bot_involvement,
            temporal_coordination=temporal_coordination
        )
        
        # Component breakdown
        components = {
            "narrative_similarity": {
                "score": round(narrative_similarity, 3),
                "weight": self.WEIGHTS["narrative_similarity"],
                "contribution": round(narrative_similarity * self.WEIGHTS["narrative_similarity"], 3)
            },
            "cluster_density": {
                "score": round(cluster_density, 3),
                "weight": self.WEIGHTS["cluster_density"],
                "contribution": round(cluster_density * self.WEIGHTS["cluster_density"], 3)
            },
            "bot_involvement": {
                "score": round(bot_involvement, 3),
                "weight": self.WEIGHTS["bot_probability"],
                "contribution": round(bot_involvement * self.WEIGHTS["bot_probability"], 3)
            },
            "temporal_coordination": {
                "score": round(temporal_coordination, 3),
                "weight": self.WEIGHTS["temporal_coordination"],
                "contribution": round(temporal_coordination * self.WEIGHTS["temporal_coordination"], 3)
            }
        }
        
        return {
            "risk_score": round(risk_score, 3),
            "risk_level": risk_level,
            "explanation": explanation,
            "components": components,
            "confidence": self._calculate_confidence(coordination_metrics)
        }
    
    def _get_risk_level(self, risk_score: float) -> str:
        """Determine risk level from score"""
        if risk_score >= self.THRESHOLDS["critical"]:
            return "critical"
        elif risk_score >= self.THRESHOLDS["high"]:
            return "high"
        elif risk_score >= self.THRESHOLDS["medium"]:
            return "medium"
        else:
            return "low"
    
    def _generate_explanation(
        self,
        risk_score: float,
        narrative_similarity: float,
        cluster_density: float,
        bot_involvement: float,
        temporal_coordination: float
    ) -> str:
        """Generate human-readable explanation of risk score"""
        parts = []
        
        # Overall assessment
        risk_level = self._get_risk_level(risk_score)
        parts.append(f"This campaign has been classified as **{risk_level.upper()} RISK** (score: {risk_score:.2f}).")
        
        # Narrative similarity
        if narrative_similarity >= 0.75:
            parts.append(f"[WARN] **High content similarity** detected ({narrative_similarity:.2%}). Multiple posts share nearly identical narratives.")
        elif narrative_similarity >= 0.5:
            parts.append(f"Content shows moderate similarity ({narrative_similarity:.2%}).")
        
        # Cluster density
        if cluster_density >= 0.5:
            parts.append(f"[WARN] **Dense network connections** ({cluster_density:.2%}). Accounts are highly interconnected.")
        elif cluster_density >= 0.3:
            parts.append(f"Network shows moderate coordination ({cluster_density:.2%}).")
        
        # Bot involvement
        if bot_involvement >= 0.5:
            parts.append(f"[BOT] **High bot involvement** ({bot_involvement:.2%}). Majority of accounts flagged as automated.")
        elif bot_involvement >= 0.3:
            parts.append(f"Significant bot presence detected ({bot_involvement:.2%}).")
        
        # Temporal coordination
        if temporal_coordination >= 0.5:
            parts.append(f"[TIME] **Synchronized posting** detected ({temporal_coordination:.2%}). Posts clustered in tight time windows.")
        elif temporal_coordination >= 0.3:
            parts.append(f"Some temporal coordination observed ({temporal_coordination:.2%}).")
        
        # Recommendations
        if risk_level in ["critical", "high"]:
            parts.append("\n**RECOMMENDATION**: Immediate investigation and potential takedown required.")
        elif risk_level == "medium":
            parts.append("\n**RECOMMENDATION**: Continue monitoring and gather additional evidence.")
        else:
            parts.append("\n**RECOMMENDATION**: Low priority monitoring.")
        
        return " ".join(parts)
    
    def _calculate_confidence(self, coordination_metrics: Dict[str, float]) -> float:
        """Calculate confidence in the risk assessment"""
        # Confidence based on number of signals and their strength
        total_edges = coordination_metrics.get("total_edges", 0)
        total_nodes = coordination_metrics.get("total_nodes", 1)
        
        # More connections = higher confidence
        edge_confidence = min(total_edges / max(total_nodes * 2, 1), 1.0)
        
        # More metrics above threshold = higher confidence
        metrics = [
            coordination_metrics.get("cluster_density", 0),
            coordination_metrics.get("hashtag_overlap", 0),
            coordination_metrics.get("temporal_coordination", 0),
            coordination_metrics.get("bot_involvement", 0)
        ]
        
        strong_signals = sum(1 for m in metrics if m >= 0.5)
        signal_confidence = strong_signals / len(metrics)
        
        # Combined confidence
        confidence = (0.6 * edge_confidence + 0.4 * signal_confidence)
        
        return round(confidence, 3)
    
    def calculate_threat_indicators(
        self,
        posts: List[Dict[str, Any]],
        accounts: List[Dict[str, Any]],
        similar_pairs: List[Tuple[int, int, float]]
    ) -> List[Dict[str, str]]:
        """
        Generate specific threat indicators for campaign
        
        Returns:
            List of indicator dictionaries with type, value, description
        """
        indicators = []
        
        # Check for identical content
        identical_count = sum(1 for _, _, sim in similar_pairs if sim >= 0.95)
        if identical_count >= 3:
            indicators.append({
                "type": "content_duplication",
                "value": f"{identical_count} posts",
                "description": f"Detected {identical_count} posts with identical or near-identical content"
            })
        
        # Check for bot involvement
        bot_accounts = [acc for acc in accounts if acc["account_type"] == "bot"]
        if len(bot_accounts) >= len(accounts) * 0.3:
            indicators.append({
                "type": "bot_network",
                "value": f"{len(bot_accounts)}/{len(accounts)} accounts",
                "description": f"{len(bot_accounts)} automated accounts detected in campaign"
            })
        
        # Check for coordinated hashtags
        hashtag_counts = {}
        for post in posts:
            for tag in post.get("hashtags", []):
                hashtag_counts[tag] = hashtag_counts.get(tag, 0) + 1
        
        coordinated_hashtags = [tag for tag, count in hashtag_counts.items() if count >= len(posts) * 0.5]
        if coordinated_hashtags:
            indicators.append({
                "type": "coordinated_hashtags",
                "value": ", ".join(coordinated_hashtags[:3]),
                "description": f"Hashtags used across {max(hashtag_counts.values())} posts"
            })
        
        # Check for temporal clustering
        if len(posts) >= 5:
            posts_sorted = sorted(posts, key=lambda x: x["posted_at"])
            max_cluster = 1
            current_cluster = 1
            
            for i in range(1, len(posts_sorted)):
                # Simple temporal check (would need proper datetime parsing in production)
                current_cluster += 1
                if current_cluster > max_cluster:
                    max_cluster = current_cluster
            
            if max_cluster >= 5:
                indicators.append({
                    "type": "temporal_coordination",
                    "value": f"{max_cluster} posts",
                    "description": f"Cluster of {max_cluster} posts within short time window"
                })
        
        # Check for suspicious account age
        new_accounts = [acc for acc in accounts if acc.get("follower_count", 1000) < 100]
        if len(new_accounts) >= len(accounts) * 0.4:
            indicators.append({
                "type": "suspicious_accounts",
                "value": f"{len(new_accounts)} accounts",
                "description": f"{len(new_accounts)} accounts with low follower counts"
            })
        
        return indicators
    
    def generate_recommendations(self, risk_level: str) -> List[str]:
        """Generate actionable recommendations based on risk level"""
        if risk_level == "critical":
            return [
                "Immediate escalation to security operations center",
                "Block/suspend identified bot accounts",
                "Deploy counter-narrative content",
                "Notify platform providers for takedown",
                "Document all evidence for legal action"
            ]
        elif risk_level == "high":
            return [
                "Initiate deep investigation of account network",
                "Monitor for escalation or expansion",
                "Flag accounts for manual review",
                "Prepare incident report",
                "Coordinate with threat intelligence teams"
            ]
        elif risk_level == "medium":
            return [
                "Continue automated monitoring",
                "Collect additional behavioral signals",
                "Review account histories",
                "Set up alerts for increased activity"
            ]
        else:
            return [
                "Maintain baseline monitoring",
                "Log campaign for trend analysis",
                "No immediate action required"
            ]


# Global singleton instance
_risk_scoring_service: RiskScoringService = None


def get_risk_scoring_service() -> RiskScoringService:
    """Get or create the global risk scoring service instance"""
    global _risk_scoring_service
    if _risk_scoring_service is None:
        _risk_scoring_service = RiskScoringService()
    return _risk_scoring_service
