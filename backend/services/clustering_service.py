"""
Clustering Service: Production-grade graph analysis for coordination detection
Optimized for: Memory efficiency, thread-safety, and robust network metrics
"""

import threading
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Set, Tuple

import networkx as nx
import numpy as np


class ClusteringService:
    """Production architect: Handles graph-based coordination detection with resource safeguards"""
    
    # Scaling Protection
    MAX_NODES = 2000  # Prevent memory explosion in high-density graphs
    
    def __init__(self):
        """Initialize clustering service"""
        self.graph = None
    
    def build_campaign_graph(
        self,
        posts: List[Dict[str, Any]],
        accounts: List[Dict[str, Any]],
        embeddings_similarity: np.ndarray = None
    ) -> nx.Graph:
        """
        Memory-efficient graph construction with type-safe edge weights
        """
        G = nx.Graph()
        
        # Guard: scaling protection
        if len(posts) + len(accounts) > self.MAX_NODES:
            print(f"[WARN] [Arch] Graph nodes ({len(posts) + len(accounts)}) exceed limit. Truncating for stability.")
            posts = posts[:self.MAX_NODES // 2]
            accounts = accounts[:self.MAX_NODES // 2]

        # Component 1: Node Injection
        for account in accounts:
            if not account or "id" not in account: continue
            G.add_node(
                account["id"],
                node_type="account",
                username=account.get("username", "unknown"),
                bot_probability=account.get("bot_probability", 0.0)
            )
        
        for idx, post in enumerate(posts):
            if not post or "id" not in post: continue
            post_id = post["id"]
            G.add_node(
                post_id,
                node_type="post",
                platform=post.get("platform", "unknown"),
                post_index=idx
            )
            
            # Authorship Bridge
            author_id = post.get("account_id")
            if author_id in G:
                G.add_edge(author_id, post_id, edge_type="authorship", weight=1.0)
        
        # Component 2: Content Similarity Linkage (O(n^2) safe via pre-calculated matrix)
        if embeddings_similarity is not None and len(posts) < 1000:
            n_posts = len(posts)
            for i in range(n_posts):
                for j in range(i + 1, n_posts):
                    sim = float(embeddings_similarity[i][j])
                    if sim >= 0.85:  # Production threshold for structural links
                        G.add_edge(posts[i]["id"], posts[j]["id"], edge_type="content", weight=sim)
        
        self.graph = G
        return G
    
    def _calculate_time_diff(self, time1: Any, time2: Any) -> float:
        """Robust timestamp delta calculation with fail-safe"""
        if not time1 or not time2: return 86400.0 # Default to 1 day if missing
        try:
            if isinstance(time1, str):
                dt1 = datetime.fromisoformat(time1.replace('Z', '+00:00'))
            else: dt1 = time1
            
            if isinstance(time2, str):
                dt2 = datetime.fromisoformat(time2.replace('Z', '+00:00'))
            else: dt2 = time2
                
            return abs((dt2 - dt1).total_seconds())
        except Exception:
            return 86400.0
    
    def detect_communities(self, graph: nx.Graph = None) -> List[Set[str]]:
        """Louvain community detection with robust fallbacks"""
        target = graph if graph is not None else self.graph
        if not target or target.number_of_nodes() == 0:
            return []
        
        # Try Louvain (C-based or optimized python-louvain)
        try:
            import community as community_louvain
            partition = community_louvain.best_partition(target, weight='weight')
            comm_map = defaultdict(set)
            for node, cid in partition.items():
                comm_map[cid].add(node)
            return list(comm_map.values())
        except Exception:
            # Fallback to standard connected components for zero-trust stability
            return [set(c) for c in nx.connected_components(target)]
    
    def calculate_coordination_score(
        self,
        posts: List[Dict[str, Any]],
        accounts: List[Dict[str, Any]],
        similar_pairs: List[Tuple[int, int, float]] = None
    ) -> Dict[str, Any]:
        """Weighted coordination assessment with strict division-by-zero protection"""
        # Baseline guards
        if not posts or not accounts:
            return {"coordination_score": 0.0, "cluster_density": 0.0, "hashtag_overlap": 0.0, "temporal_coordination": 0.0, "bot_involvement": 0.0}
        
        # Graph construction
        graph = self.build_campaign_graph(posts, accounts)
        
        # 1. Density Metric
        nodes_count = graph.number_of_nodes()
        if nodes_count > 1:
            possible = (nodes_count * (nodes_count - 1)) / 2
            density = graph.number_of_edges() / possible
        else: density = 0.0
        
        # 2. Shared Signal (Hashtags)
        all_tags = []
        for p in posts: all_tags.extend(p.get("hashtags", []))
        if all_tags:
            tag_map = defaultdict(int)
            for t in all_tags: tag_map[t] += 1
            overlap = sum(1 for c in tag_map.values() if c > 1) / len(tag_map)
        else: overlap = 0.0
            
        # 3. Temporal Bursts
        times = sorted([p.get("posted_at") for p in posts if p.get("posted_at")])
        bursts = 0
        if len(times) >= 3:
            for i in range(len(times)-2):
                if self._calculate_time_diff(times[i], times[i+2]) < 300: # 3 posts in 5 mins
                    bursts += 1
        temporal = min(bursts / max(len(posts)/5, 1), 1.0)
        
        # 4. Bot Signal
        bots = sum(1 for a in accounts if a.get("account_type") == "bot")
        bot_ratio = bots / len(accounts) if accounts else 0.0
        
        # Weighted Calculation
        agg_score = (density * 0.3) + (overlap * 0.2) + (temporal * 0.3) + (bot_ratio * 0.2)
        
        return {
            "coordination_score": round(agg_score, 3),
            "cluster_density": round(density, 3),
            "hashtag_overlap": round(overlap, 3),
            "temporal_coordination": round(temporal, 3),
            "bot_involvement": round(bot_ratio, 3),
            "total_nodes": nodes_count,
            "total_edges": graph.number_of_edges()
        }


# --- Thread-Safe Singleton ---
_clustering_instance: ClusteringService = None
_clustering_lock = threading.Lock()

def get_clustering_service() -> ClusteringService:
    global _clustering_instance
    if _clustering_instance is None:
        with _clustering_lock:
            if _clustering_instance is None:
                _clustering_instance = ClusteringService()
    return _clustering_instance
