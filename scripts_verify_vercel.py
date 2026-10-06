"""Dependency-free packaging check for the Vercel deployment layout."""
from pathlib import Path
import json
import ast

root = Path(__file__).resolve().parent
required = [
    "index.py", "vercel.json", "requirements.txt", ".python-version",
    ".env.vercel.example", "backend/app/main.py", "frontend/index.html",
    "frontend/app.js", "frontend/ui.js", "frontend/styles.css",
]
missing = [p for p in required if not (root / p).exists()]
if missing:
    raise SystemExit(f"Missing required files: {missing}")

json.loads((root / "vercel.json").read_text())
ast.parse((root / "index.py").read_text(), filename="index.py")
ast.parse((root / "backend/app/core/config.py").read_text(), filename="config.py")
ast.parse((root / "backend/app/core/database.py").read_text(), filename="database.py")

app_text = (root / "frontend/app.js").read_text()
if "window.FASHIONCART_API_URL || '/api'" not in app_text:
    raise SystemExit("Frontend API base is no longer same-origin /api")

print("Vercel package structure: OK")
print("Frontend same-origin /api wiring: OK")
print("vercel.json: valid JSON")
print("Python deployment files: syntax OK")
