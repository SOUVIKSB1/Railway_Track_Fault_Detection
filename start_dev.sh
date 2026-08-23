#!/bin/bash
# ==============================================================================
# IRCTC RailTech AI — Dual Dev Server (Vite Hot Reload + FastAPI Backend)
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "🚂 Starting FastAPI Backend on :8000..."
export MPLBACKEND=Agg
export MPLCONFIGDIR=/tmp/mpl
export TF_CPP_MIN_LOG_LEVEL=2
python3 -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

echo "⚡ Starting Vite Frontend on :5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
