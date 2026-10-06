"""Tiny post-deploy smoke check using only the Python standard library.

Usage:
    python deployment/smoke_vercel.py https://your-project.vercel.app
"""
from __future__ import annotations

import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

if len(sys.argv) != 2:
    raise SystemExit("Usage: python deployment/smoke_vercel.py https://your-project.vercel.app")

base = sys.argv[1].rstrip("/")
checks = [
    ("/", "text/html"),
    ("/health", "application/json"),
    ("/health/ready", "application/json"),
    ("/openapi.json", "application/json"),
]

failed = False
for path, expected_type in checks:
    url = base + path
    try:
        req = Request(url, headers={"User-Agent": "FashionCart-Smoke/1.0"})
        with urlopen(req, timeout=20) as response:
            body = response.read(2048)
            ctype = response.headers.get("Content-Type", "")
            ok = response.status == 200 and expected_type in ctype
            if path == "/health/ready" and ok:
                try:
                    payload = json.loads(body)
                    ok = payload.get("status") == "ready" and payload.get("database") == "ok"
                except Exception:
                    ok = False
            print(f"{'PASS' if ok else 'FAIL'} {path} HTTP {response.status} {ctype}")
            failed = failed or not ok
    except (HTTPError, URLError, TimeoutError) as exc:
        print(f"FAIL {path} {exc}")
        failed = True

raise SystemExit(1 if failed else 0)
