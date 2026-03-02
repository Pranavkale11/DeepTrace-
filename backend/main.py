# ⚠️ Windows DLL Fix: torch must be imported FIRST before any other module.
# This prevents WinError 1114 (c10.dll initialization failure) on Windows.
import torch  # noqa: F401 — Must be first import

import os
from pathlib import Path
from dotenv import load_dotenv

# Always load .env from the same directory as this file (backend/.env)
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Import routers
from api import campaigns, analytics, posts, accounts, reports, analyze, youtube, autonomous_threat

# Create FastAPI app
app = FastAPI(
    title="DeepTrace API",
    description="AI-powered cyber-intelligence platform for detecting coordinated influence and disinformation campaigns",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(campaigns.router)
app.include_router(analytics.router)
app.include_router(posts.router)
app.include_router(accounts.router)
app.include_router(reports.router)
app.include_router(analyze.router)
app.include_router(youtube.router)
app.include_router(autonomous_threat.router)  # Autonomous Hostile Narrative Scan


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API health check"""
    return {
        "success": True,
        "message": "DeepTrace API is running",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "docs": "/docs",
        "endpoints": {
            "campaigns": "/api/campaigns",
            "analytics": "/api/analytics/overview",
            "posts": "/api/posts",
            "accounts": "/api/accounts",
            "reports": "/api/reports",
            "analyze": "/api/analyze",
            "youtube_scan": "/api/youtube/analyze",
            "youtube_cross_video": "/api/youtube/analyze-cross-video",
            "autonomous_threat_scan": "/api/youtube/autonomous-threat-scan"
        }
    }


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# Startup event
@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    print("=" * 60)
    print("STARTING - DeepTrace Backend API Starting...")
    print("=" * 60)
    
    # Pre-initialize AI services (Warm up the models)
    try:
        from services.embedding_service import get_embedding_service
        from services.clustering_service import get_clustering_service
        from services.risk_scoring_service import get_risk_scoring_service
        from services.narrative_detection_service import get_narrative_detection_service
        
        print("AI - Pre-warming AI models...")
        get_embedding_service()
        get_clustering_service()
        get_risk_scoring_service()
        get_narrative_detection_service()  # Pre-encode hostile narrative pattern library
        print("[OK] All AI models initialized and ready!")
    except Exception as e:
        print(f"[ERROR] Error during model initialization: {str(e)}")
        print("[WARN] Application will continue, but first AI requests may be slow or fail.")

    print("=" * 60)
    print("INFO - API Documentation: http://localhost:8000/docs")
    print("INFO - ReDoc Documentation: http://localhost:8000/redoc")
    print("INFO - Root Endpoint: http://localhost:8000/")
    print("=" * 60)


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    print("=" * 60)
    print("STOP - DeepTrace Backend API Shutting Down...")
    print("=" * 60)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
