#!/bin/bash
# ==============================================================================
# IRCTC / Indian Railways AI Track Fault Detection — One-Click Launch Script
# ==============================================================================

set -e

echo "🚂 =============================================================="
echo "   IRCTC / Indian Railways RailTech AI — Diagnostic Core"
echo "=============================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# 1. Build frontend if not already built or rebuild
if [ ! -d "frontend/dist" ]; then
    echo "📦 Building React + Tailwind + Framer Motion Frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
    echo "✅ Frontend built successfully in frontend/dist/"
fi

# 2. Launch FastAPI Server on port 8000
echo "🚀 Starting FastAPI Unified Server on http://localhost:8000..."
echo "   Open http://localhost:8000 in your browser to access the dashboard."
echo "=============================================================="

export MPLBACKEND=Agg
export MPLCONFIGDIR=/tmp/mpl
export TF_CPP_MIN_LOG_LEVEL=2

python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
