import json
import os
from typing import List, Dict, Any, Optional
from pathlib import Path

# Get the base directory
BASE_DIR = Path(__file__).resolve().parent.parent
MOCK_DATA_DIR = BASE_DIR / "mock_data"


class DataLoader:
    """Loads and manages mock data from JSON files"""
    
    def __init__(self):
        self.campaigns: List[Dict[str, Any]] = []
        self.posts: List[Dict[str, Any]] = []
        self.accounts: List[Dict[str, Any]] = []
        self.threat_scores: List[Dict[str, Any]] = []
        self.reports: List[Dict[str, Any]] = []
        self.load_all_data()
    
    def load_json_file(self, filename: str) -> List[Dict[str, Any]]:
        """Load data from a JSON file"""
        file_path = MOCK_DATA_DIR / filename
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: {filename} not found at {file_path}")
            return []
        except json.JSONDecodeError as e:
            print(f"Error decoding {filename}: {e}")
            return []
    
    def load_all_data(self):
        """Load all mock data files"""
        self.campaigns = self.load_json_file("campaigns.json")
        self.posts = self.load_json_file("posts.json")
        self.accounts = self.load_json_file("accounts.json")
        self.threat_scores = self.load_json_file("threat_scores.json")
        self.reports = self.load_json_file("reports.json")
        print(f"[OK] Loaded {len(self.campaigns)} campaigns")
        print(f"[OK] Loaded {len(self.posts)} posts")
        print(f"[OK] Loaded {len(self.accounts)} accounts")
        print(f"[OK] Loaded {len(self.threat_scores)} threat scores")
        print(f"[OK] Loaded {len(self.reports)} reports")
    
    # Campaign methods
    def get_all_campaigns(self) -> List[Dict[str, Any]]:
        """Get all campaigns"""
        return self.campaigns
    
    def get_campaign_by_id(self, campaign_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific campaign by ID"""
        for campaign in self.campaigns:
            if campaign["id"] == campaign_id:
                return campaign
        return None
    
    def filter_campaigns(
        self,
        status: Optional[str] = None,
        threat_level: Optional[str] = None,
        campaign_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Filter campaigns by various criteria"""
        filtered = self.campaigns.copy()
        
        if status and status != "all":
            filtered = [c for c in filtered if c["status"] == status]
        
        if threat_level and threat_level != "all":
            filtered = [c for c in filtered if c["threat_level"] == threat_level]
        
        if campaign_type and campaign_type != "all":
            filtered = [c for c in filtered if c["campaign_type"] == campaign_type]
        
        return filtered
    
    # Post methods
    def get_all_posts(self) -> List[Dict[str, Any]]:
        """Get all posts"""
        return self.posts
    
    def get_posts_by_campaign(self, campaign_id: str) -> List[Dict[str, Any]]:
        """Get all posts for a specific campaign"""
        return [p for p in self.posts if p.get("campaign_id") == campaign_id]
    
    def filter_posts(
        self,
        platform: Optional[str] = None,
        is_flagged: Optional[bool] = None
    ) -> List[Dict[str, Any]]:
        """Filter posts by various criteria"""
        filtered = self.posts.copy()
        
        if platform and platform != "all":
            filtered = [p for p in filtered if p["platform"] == platform]
        
        if is_flagged is not None:
            filtered = [p for p in filtered if p["is_flagged"] == is_flagged]
        
        return filtered
    
    # Account methods
    def get_all_accounts(self) -> List[Dict[str, Any]]:
        """Get all accounts"""
        return self.accounts
    
    def get_account_by_id(self, account_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific account by ID"""
        for account in self.accounts:
            if account["id"] == account_id:
                return account
        return None
    
    def get_accounts_by_campaign(self, campaign_id: str) -> List[Dict[str, Any]]:
        """Get all accounts involved in a campaign"""
        # Get all posts in the campaign
        campaign_posts = self.get_posts_by_campaign(campaign_id)
        account_ids = list(set([p["account_id"] for p in campaign_posts]))
        
        # Get account details
        accounts = []
        for acc_id in account_ids:
            account = self.get_account_by_id(acc_id)
            if account:
                # Add campaign-specific info
                account_posts = [p for p in campaign_posts if p["account_id"] == acc_id]
                account_copy = account.copy()
                account_copy["post_count_in_campaign"] = len(account_posts)
                if account_posts:
                    account_copy["first_post_at"] = min(p["posted_at"] for p in account_posts)
                    account_copy["last_post_at"] = max(p["posted_at"] for p in account_posts)
                accounts.append(account_copy)
        
        return accounts
    
    def filter_accounts(
        self,
        account_type: Optional[str] = None,
        min_bot_probability: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Filter accounts by various criteria"""
        filtered = self.accounts.copy()
        
        if account_type and account_type != "all":
            filtered = [a for a in filtered if a["account_type"] == account_type]
        
        if min_bot_probability is not None:
            filtered = [a for a in filtered if a["bot_probability"] >= min_bot_probability]
        
        return filtered
    
    # Threat score methods
    def get_threat_score_by_campaign(self, campaign_id: str) -> Optional[Dict[str, Any]]:
        """Get threat score for a specific campaign"""
        for score in self.threat_scores:
            if score["campaign_id"] == campaign_id:
                return score
        return None
    
    # Report methods
    def get_all_reports(self) -> List[Dict[str, Any]]:
        """Get all reports"""
        return self.reports
    
    def get_report_by_id(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific report by ID"""
        for report in self.reports:
            if report["id"] == report_id:
                return report
        return None
    
    def filter_reports(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        report_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Filter reports by various criteria"""
        filtered = self.reports.copy()
        
        if status and status != "all":
            filtered = [r for r in filtered if r["status"] == status]
        
        if severity and severity != "all":
            filtered = [r for r in filtered if r["severity"] == severity]
        
        if report_type and report_type != "all":
            filtered = [r for r in filtered if r["report_type"] == report_type]
        
        return filtered


# Global data loader instance
data_loader = DataLoader()
