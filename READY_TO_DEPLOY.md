# FashionCart Vercel + Cloudflare Readiness

## Package status

**Code/package status: READY for a Vercel deployment candidate.**

The deployment package now contains:

- Vercel-recognized FastAPI entrypoint: `index.py`
- root production dependencies: `requirements.txt`
- Python runtime pin: `.python-version` (3.12)
- Vercel project configuration: `vercel.json`
- Vercel bundle exclusions: `.vercelignore`
- Vercel environment template: `.env.vercel.example`
- serverless-safe configurable SQLAlchemy connection pooling
- same-origin frontend/API wiring (`/api`)
- Cloudflare DNS + Vercel deployment guide
- live post-deploy smoke checker: `deployment/smoke_vercel.py`
- original Docker deployment files preserved as an alternative

## Values that cannot safely be pre-filled in a ZIP

Before the first real Vercel deployment, provide:

1. a reachable persistent managed MySQL `DATABASE_URL`;
2. a random production `JWT_SECRET` (32+ characters);
3. the real `CORS_ORIGINS` domain(s);
4. the intended `ALLOW_REGISTRATION` value.

Those are deployment secrets/settings, not missing application code.

## Validation performed in this package

- Python source compilation: PASS
- frontend JavaScript syntax: PASS
- `vercel.json` JSON validation: PASS
- Vercel package-structure verifier: PASS
- same-origin `/api` frontend wiring check: PASS
- local FastAPI route/static smoke check using SQLite: PASS for `/`, `/styles.css`, `/app.js`, `/health`, `/health/ready`, `/openapi.json`

The inspection environment does not have `python-jose`, Passlib, or bcrypt installed and cannot download them, so the full pinned dependency install was not repeated locally. Those dependencies are declared in `requirements.txt` and are installed by Vercel during a real build.

## First live verification

After deploying, run:

```bash
python deployment/smoke_vercel.py https://YOUR_PROJECT.vercel.app
```

Then seed the managed MySQL database once if you want the bundled demo dataset and demo roles. See `VERCEL_CLOUDFLARE_DEPLOY.md`.
