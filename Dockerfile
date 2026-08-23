# Multi-stage Dockerfile for IRCTC RailTech AI
# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend & Static Server
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY RAILWAY_DEFECT/ RAILWAY_DEFECT/
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

ENV PORT=8000
ENV HOST=0.0.0.0
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV MPLBACKEND=Agg
ENV MPLCONFIGDIR=/tmp/mpl

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
