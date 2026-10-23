# Live Cards: one container serves the API, the WebSocket streams and the built web app.

# ---- web: React + three.js ----
FROM node:22.11-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY web/ ./
RUN npm run postinstall && npm run build

# ---- api: Python 3.12 + uv ----
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.19 /uv /usr/local/bin/uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --extra agents --extra azure --no-install-project
COPY backend/ ./
RUN uv sync --frozen --no-dev --extra agents --extra azure
COPY --from=web /web/dist /app/web/dist
ENV PYTHONUNBUFFERED=1 AUDIT_DB=/tmp/audit.db
EXPOSE 8000
CMD ["/app/backend/.venv/bin/uvicorn", "livecards.server.app:app", "--host", "0.0.0.0", "--port", "8000"]
