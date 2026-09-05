# Multi-stage Dockerfile for RailVision AI
# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Ultra-Lightweight Python Backend & Static Server
FROM python:3.12-slim
WORKDIR /app

# Set environment flags for minimal memory and fast execution
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV HOST=0.0.0.0
ENV MPLBACKEND=Agg
ENV MPLCONFIGDIR=/tmp/mpl

# Install lightweight Python dependencies (< 40MB total)
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application files (raw datasets excluded via .dockerignore)
COPY backend/ backend/
COPY RAILWAY_DEFECT/ RAILWAY_DEFECT/
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 8000

CMD ["sh", "-c", "python -m uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
