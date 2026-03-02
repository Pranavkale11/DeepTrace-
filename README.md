# DeepTrace

AI-powered campaign detection and coordination analysis platform designed to identify inauthentic behavior and coordinated influence operations.
[Tagline]: Hardened Intelligence for the Modern Information Landscape.

## Features

### Narrative Similarity Detection
Uses state-of-the-art Natural Language Processing (NLP) with Sentence-Transformers to detect near-identical or paraphrased content across multiple platforms.

### Campaign Clustering
Employs graph-theory based analysis using NetworkX to identify tightly-knit clusters of accounts exhibiting coordinated posting patterns.

### Risk Scoring Engine
A multi-signal weighted scoring system that evaluates narrative duplication, cluster density, bot probability, and temporal coordination to provide a unified threat level.

### Explainable AI Outputs
Transparency-focused results that provide human-readable explanations for every risk score, identifying specific threat indicators and tactical recommendations.

### Dashboard Visualization
Intuitive data visualization using Recharts and Framer Motion to present complex network metrics in a clean, professional interface.

### CPU-Safe Inference
Optimized for production stability and resource efficiency, ensuring high-performance AI inference without the requirement for dedicated GPU hardware.

## Architecture Overview

DeepTrace operates on a decoupled architecture optimized for real-time intelligence.

1. **Data Ingestion**: The platform ingests social media data (posts, accounts, and metadata) via structured API endpoints.
2. **AI Pipeline**:
    - **Vectorization**: Content is converted into high-dimensional embeddings.
    - **Correlation**: Semantic similarity search identifies duplicate narratives.
    - **Network Analysis**: A coordination graph is built where nodes represent accounts/posts and edges represent behavioral links.
    - **Scoring**: The Risk Scoring Engine aggregates signals to categorize the campaign threat level.
3. **Backend-Frontend Interaction**: FastAPI serves the processed intelligence through a RESTful API, which is then dynamically rendered by the Next.js frontend with real-time state management.

## Project Structure

```text
INNOVIT/
├── backend/                  # Python FastAPI Backend
│   ├── api/                  # API Route Handlers
│   ├── services/             # AI Logic (NLP, Graph, Risk)
│   ├── models/               # Pydantic Schemas
│   ├── utils/                # Data Loading & Helpers
│   ├── mock_data/            # Simulation Datasets
│   └── main.py              # Application Entry Point
├── src/                      # Next.js Frontend Source
│   ├── app/                  # App Router Pages
│   ├── components/           # Reusable UI Components
│   └── lib/                  # Frontend Utilities
├── public/                   # Static Assets
└── package.json              # Node.js Configuration
```

## How to Run

Follow these instructions for local development on Windows.

### Backend Setup

Navigate to the backend directory and initialize the environment:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

- **Interactive Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### Frontend Setup

In a new PowerShell terminal, navigate to the root directory and start the UI:

```powershell
cd ..
npm install
npm run dev
```

- **Application URL**: [http://localhost:3000](http://localhost:3000)

## Troubleshooting

### Port 8000 Already in Use
If the backend fails to start because the port is occupied, kill the existing process:
```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -Force
```

### Port 3000 Already in Use
If the frontend port is blocked:
```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
```

### Virtual Environment Activation
If PowerShell scripts are restricted, run the following command once as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Torch CPU Installation
The engine is configured for `torch+cpu`. If you encounter installation errors, ensure you are using the correct index:
`pip install torch --index-url https://download.pytorch.org/whl/cpu`

## Deployment

**Frontend Deployment:**
[Add Link Here]

**Backend API:**
[Add Link Here]

**Demo Video:**
[Add Link Here]

## Future Roadmap

### Real-Time API Ingestion
Integration with live social media streams (X, Telegram, Reddit) for sub-minute detection of emerging influence operations.

### Deepfake Detection
Implementation of multimodal analysis to identify AI-generated profile pictures and media assets within coordinated networks.

### Counter-Narrative AI
Generative AI module to draft proactive counter-disinformation messaging based on identified campaign themes.

### Cloud-Scale Deployment
Transition to a containerized microservices architecture with Redis-based caching and GPU-accelerated inference for enterprise workloads.

## Tech Stack

### Backend
- FastAPI
- Sentence Transformers (all-MiniLM-L6-v2)
- NetworkX
- scikit-learn
- PyTorch (CPU)

### Frontend
- Next.js 16 (React 19)
- TailwindCSS
- Recharts
- Framer Motion
- Lucide React

## License

This project is licensed under the MIT License - see the LICENSE file for details.
