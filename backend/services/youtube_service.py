import os
import threading
from datetime import datetime
from typing import List, Dict, Any
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

class YouTubeService:
    """
    YouTube Data API v3 integration service for DeepTrace.
    Fetches public video data and comments for analysis.
    """
    
    def __init__(self):
        self.api_key = os.getenv("YOUTUBE_API_KEY")
        self._youtube = None
        self._lock = threading.Lock()
        
        if not self.api_key:
            print("⚠️ [YouTube] YOUTUBE_API_KEY not found in environment. Service will fail until configured.")

    def _get_client(self):
        """Lazy initialization of the YouTube API client"""
        if not self.api_key:
            raise ValueError("YOUTUBE_API_KEY environment variable is missing.")
            
        if self._youtube is None:
            with self._lock:
                if self._youtube is None:
                    try:
                        self._youtube = build("youtube", "v3", developerKey=self.api_key)
                        print("✅ [YouTube] API client initialized successfully.")
                    except Exception as e:
                        print(f"❌ [YouTube] Failed to initialize client: {str(e)}")
                        raise Exception(f"YouTube Service Initialization Error: {str(e)}")
        return self._youtube

    def fetch_videos(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """Fetch top N videos based on a search query"""
        client = self._get_client()
        try:
            request = client.search().list(
                q=query,
                part="id,snippet",
                type="video",
                maxResults=max_results,
                relevanceLanguage="en"
            )
            response = request.execute()
            
            videos = []
            for item in response.get("items", []):
                videos.append({
                    "video_id": item["id"]["videoId"],
                    "title": item["snippet"]["title"],
                    "channel_title": item["snippet"]["channelTitle"],
                    "channel_id": item["snippet"]["channelId"],
                    "published_at": item["snippet"]["publishedAt"]
                })
            return videos
        except HttpError as e:
            self._handle_http_error(e)
        except Exception as e:
            raise Exception(f"YouTube Search Error: {str(e)}")

    def fetch_comments(self, video_id: str, max_results: int = 20) -> List[Dict[str, Any]]:
        """Fetch top M comments for a specific video"""
        client = self._get_client()
        try:
            request = client.commentThreads().list(
                part="snippet",
                videoId=video_id,
                maxResults=max_results,
                textFormat="plainText",
                order="relevance" # Most relevant comments first
            )
            response = request.execute()
            
            comments = []
            for item in response.get("items", []):
                snippet = item["snippet"]["topLevelComment"]["snippet"]
                comments.append({
                    "comment_id": item["id"],
                    "content": snippet["textDisplay"],
                    "author_name": snippet["authorDisplayName"],
                    "author_channel_id": snippet["authorChannelId"].get("value", "unknown") if "authorChannelId" in snippet else "unknown",
                    "like_count": snippet.get("likeCount", 0),
                    "published_at": snippet["publishedAt"],
                    "video_id": video_id
                })
            return comments
        except HttpError as e:
            # Handle cases where comments are disabled
            error_details = str(e)
            if e.resp.status == 403 and "commentsDisabled" in error_details:
                print(f"ℹ️ [YouTube] Comments are disabled for video: {video_id}")
                return []
            self._handle_http_error(e)
        except Exception as e:
            raise Exception(f"YouTube Comment Fetch Error: {str(e)}")

    def _handle_http_error(self, e: HttpError):
        """Unified error handling for YouTube API exceptions"""
        status = e.resp.status
        try:
            error_data = e.json()
            error_message = error_data.get("error", {}).get("message", e.reason)
            reason = error_data.get("error", {}).get("errors", [{}])[0].get("reason", "unknown")
        except:
            error_message = e.reason
            reason = "unknown"

        if status == 403:
            if reason == "quotaExceeded":
                raise Exception("YouTube API Quota Exceeded. Please try again later.")
            elif reason == "commentsDisabled":
                return [] # Should be handled by caller
            else:
                raise Exception(f"YouTube API Forbidden: {error_message}")
        elif status == 400:
            raise Exception(f"YouTube API Bad Request: {error_message}")
        elif status == 401:
            raise Exception("YouTube API Unauthorized: Check your YOUTUBE_API_KEY.")
        else:
            raise Exception(f"YouTube API Error ({status}): {error_message}")

# Singleton Pattern for service access
_instance = None
def get_youtube_service():
    global _instance
    if _instance is None:
        _instance = YouTubeService()
    return _instance
