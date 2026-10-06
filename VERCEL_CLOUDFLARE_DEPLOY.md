# FashionCart — Vercel + Cloudflare Deployment

This package is prepared for **Vercel application hosting** with **Cloudflare used as the DNS provider**. The database remains an external managed MySQL service because Vercel functions do not provide a persistent MySQL server/volume.

## Architecture

```text
Browser
  |
  | HTTPS
  v
Cloudflare DNS (DNS-only records recommended)
  |
  v
Vercel
  |-- static FashionCart frontend
  |-- FastAPI /api + health/docs routes
  |
  v
Managed MySQL (persistent)
```

> Vercel recommends against putting a Cloudflare reverse proxy/CDN in front of Vercel because double proxying can reduce traffic visibility, add latency, and complicate caching. Keep the Cloudflare zone if you want, but use the Vercel-provided DNS target and start with Cloudflare **Proxy status = DNS only** (grey cloud).

## 1. Create a managed MySQL database

Use any MySQL-compatible provider reachable from Vercel. Obtain one SQLAlchemy-compatible connection URL:

```text
mysql+pymysql://USER:PASSWORD@HOST:3306/DATABASE
```

If the provider requires TLS-specific query parameters or a CA certificate, follow that provider's PyMySQL/SQLAlchemy connection instructions and put the final URL in `DATABASE_URL`.

## 2. Import this folder into Vercel

The Vercel project **Root Directory must be this directory** (the directory containing `index.py`, `vercel.json`, `requirements.txt`, `backend/`, and `frontend/`).

The deployment entrypoint is `index.py`. It imports the existing FastAPI backend and mounts the existing frontend after all API routes.

No Nginx container and no Docker Compose service are required on Vercel.

## 3. Add Vercel environment variables BEFORE the production deploy

Copy the values from `.env.vercel.example` into Vercel Project Settings -> Environment Variables.

Required:

```text
APP_ENV=production
DEBUG=false
DATABASE_URL=<managed MySQL URL>
JWT_SECRET=<long random secret, minimum 32 characters>
```

Recommended:

```text
ACCESS_TOKEN_EXPIRE_MINUTES=120
ALLOW_REGISTRATION=false
RATE_LIMIT_ENABLED=true
CORS_ORIGINS=https://YOUR_DOMAIN,https://YOUR_PROJECT.vercel.app
LOG_LEVEL=INFO
DB_POOL_SIZE=2
DB_MAX_OVERFLOW=3
DB_POOL_RECYCLE=300
DB_POOL_TIMEOUT=10
```

Generate `JWT_SECRET` locally with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Never commit the generated value.

## 4. Deploy

From the project root:

```bash
vercel link
vercel deploy
```

After the preview works:

```bash
vercel deploy --prod
```

You can also import the Git repository from the Vercel dashboard instead of using the CLI.

## 5. Initialize / seed the database once

The application creates missing tables at FastAPI startup. For the supplied demo accounts/products/orders, run the existing seed script **once** from a trusted local machine with the production `DATABASE_URL` and `JWT_SECRET` set.

macOS/Linux example:

```bash
export APP_ENV=production
export DATABASE_URL='mysql+pymysql://USER:PASSWORD@HOST:3306/DATABASE'
export JWT_SECRET='YOUR_LONG_RANDOM_SECRET'
PYTHONPATH=backend python -m scripts.seed
```

PowerShell example:

```powershell
$env:APP_ENV="production"
$env:DATABASE_URL="mysql+pymysql://USER:PASSWORD@HOST:3306/DATABASE"
$env:JWT_SECRET="YOUR_LONG_RANDOM_SECRET"
$env:PYTHONPATH="backend"
python -m scripts.seed
```

The current seed script creates these demonstration accounts only when they do not already exist:

- `admin@fashioncart.dev` / `Admin@123`
- `analyst@fashioncart.dev` / `Analyst@123`
- `user@fashioncart.dev` / `User@123`

**For any public deployment, immediately change those passwords or replace the seed credentials before seeding.** Keep `ALLOW_REGISTRATION=false` if the site is only for a controlled demo.

## 6. Verify Vercel before adding the custom domain

Check:

```text
https://YOUR_PROJECT.vercel.app/
https://YOUR_PROJECT.vercel.app/health
https://YOUR_PROJECT.vercel.app/health/ready
https://YOUR_PROJECT.vercel.app/docs
```

Expected readiness response:

```json
{"status":"ready","database":"ok"}
```

Then test login, dashboard, product/customer/order screens, CSV import, Apriori analysis, and recommendations.

## 7. Add the custom domain in Vercel

In Vercel Project -> Settings -> Domains, add your domain. Vercel will show the exact A/CNAME/TXT records required for that project.

You can also inspect with the CLI:

```bash
vercel domains add example.com YOUR_PROJECT
vercel domains inspect example.com
```

## 8. Configure Cloudflare DNS

Keep Cloudflare as the DNS provider and create the records shown by `vercel domains inspect` / the Vercel Domains screen.

Important:

1. Use Vercel's **exact current target** rather than copying an old IP/CNAME from a tutorial.
2. Start with **Proxy status: DNS only** (grey cloud).
3. Wait until Vercel shows the domain as verified and its SSL certificate is active.
4. Do not create a conflicting Cloudflare Worker/Pages route for the same hostname.

The app is same-origin (`/api`), so once the custom domain resolves to Vercel, the frontend and API continue to work without changing JavaScript URLs.

## 9. Final production checks

- `/` loads without console errors.
- `/health` returns HTTP 200.
- `/health/ready` returns database `ok`.
- ADMIN, ANALYST, and USER login work as intended.
- Role restrictions are enforced.
- Products/customers/orders persist after a new deployment.
- CSV upload works.
- Apriori analysis completes within the Vercel function duration.
- Recommendations return results after analysis.
- `ALLOW_REGISTRATION` matches the intended public access policy.
- No `.env` or production secret is committed or included in a public repository.

## Existing Docker deployment

The original `docker-compose.yml`, backend Dockerfile, frontend Dockerfile, and Nginx config are intentionally kept. They remain useful for local Docker development or deployment to a normal container host. Vercel ignores those files via `.vercelignore`.
