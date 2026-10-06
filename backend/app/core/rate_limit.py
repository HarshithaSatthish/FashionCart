"""Small in-memory sliding-window rate limiter (per client IP, per scope).

Good for a single-process demo deployment. For multi-worker / multi-host
deployments, swap the store for Redis (same interface).
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from app.core.config import get_settings

_hits: dict[tuple[str, str], deque] = defaultdict(deque)
_lock = Lock()


def reset() -> None:
    with _lock:
        _hits.clear()


def rate_limit(scope: str, limit: int, window_seconds: int = 60):
    def dependency(request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        with _lock:
            q = _hits[(scope, ip)]
            while q and now - q[0] > window_seconds:
                q.popleft()
            if len(q) >= limit:
                retry = max(1, int(window_seconds - (now - q[0])))
                raise HTTPException(
                    status_code=429,
                    detail={"code": "RATE_LIMITED", "message": "Too many requests. Try again shortly."},
                    headers={"Retry-After": str(retry)},
                )
            q.append(now)
    return dependency
