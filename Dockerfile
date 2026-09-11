# ==========================================
# Stage 1: Build Next.js Frontend
# ==========================================
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/src/frontend

# Install dependencies
COPY src/frontend/package*.json ./
RUN npm install

# Copy source code and build
COPY src/frontend ./

ARG NEXT_PUBLIC_SUPABASE_URL=https://ksojzigooagnczzxyadb.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzb2p6aWdvb2FnbmN6enh5YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMDU5ODEsImV4cCI6MjEwNDY4MTk4MX0.bR7Y06F0VVPB8UoSRXErBJcM2Gb303_p5HO-SJSRGcs
ARG OPENAI_API_KEY=dummy-build-key
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV OPENAI_API_KEY=${OPENAI_API_KEY}

RUN npm run build

# ==========================================
# Stage 2: Unified Single Container Runtime
# ==========================================
FROM python:3.11-slim-bookworm

WORKDIR /app

# Prevent Python from writing .pyc and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV FASTAPI_URL=http://127.0.0.1:8000
ENV REDIS_URL=redis://127.0.0.1:6379/0

# Install system dependencies: Redis, Supervisor, curl, build essentials for PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    supervisor \
    redis-server \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 runtime for Next.js
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Python microservice requirements
COPY src/backend_ai/requirements.txt /app/src/backend_ai/
RUN pip install --no-cache-dir -r /app/src/backend_ai/requirements.txt

# Copy Python AI backend code
COPY src/backend_ai /app/src/backend_ai/

# Copy built frontend application from Stage 1
COPY --from=frontend-builder /app/src/frontend /app/src/frontend/

# Copy Supervisord configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Setup directory for supervisor logs
RUN mkdir -p /var/log/supervisor /var/run

# Expose Next.js Web App (3000) & FastAPI AI Microservice (8000)
EXPOSE 3000 8000

# Start Supervisor managing Redis + FastAPI + Celery + Next.js
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
