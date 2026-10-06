"""Vercel entrypoint for FashionCart.

The production FastAPI application lives under ``backend/app``.  Vercel looks
for an ASGI variable named ``app`` at a supported root entrypoint, so this file
adds the backend package to ``sys.path``, imports the existing application, and
mounts the framework-free frontend last.  API/health/docs routes therefore
keep priority over the static frontend.
"""
from pathlib import Path
import sys

from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402  (backend path must be inserted first)

# Mount last so /api, /health, /docs, /redoc and /openapi.json remain handled
# by FastAPI. The UI uses hash routing, so StaticFiles(html=True) is sufficient.
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
