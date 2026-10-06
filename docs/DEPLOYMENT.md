# FashionCart Deployment Guide

## Vercel + Cloudflare

For the prepared Vercel deployment path, use [`../VERCEL_CLOUDFLARE_DEPLOY.md`](../VERCEL_CLOUDFLARE_DEPLOY.md). The root `index.py`, `requirements.txt`, `vercel.json`, `.vercelignore`, `.python-version`, and `.env.vercel.example` are already included. This path requires an external managed MySQL database.

The Docker instructions below remain the alternative self-hosted deployment path.

## Recommended deployment shape

Run the supplied Docker Compose stack on a Linux VPS or any platform that supports long-running Docker services and persistent volumes.

Only the frontend/Nginx port should be exposed publicly:

```text
Internet -> HTTPS reverse proxy -> FashionCart Nginx -> FastAPI -> MySQL
```

MySQL is intentionally not published in `docker-compose.yml`.

## Production checklist

1. Copy `.env.example` to `.env`.
2. Replace the MySQL passwords with strong URL-safe values.
3. Generate a random `JWT_SECRET`.
4. Set `CORS_ORIGINS` to your final domain if the API will also be accessed directly.
5. Put HTTPS in front of `APP_PORT` using Caddy, Traefik, Cloudflare Tunnel, or the provider's managed TLS.
6. Back up the `fashioncart_mysql` Docker volume.
7. Do not run the demo seed service on a real production database.
8. Remove/replace the demo accounts before using real data.

## Start

```bash
docker compose up --build -d
```

Check status:

```bash
docker compose ps
curl http://127.0.0.1:3000/health/ready
```

View logs:

```bash
docker compose logs -f --tail=200
```

## Initial demo seed

For a portfolio/demo deployment only:

```bash
docker compose --profile tools run --rm seed
```

## Upgrade deployment

```bash
git pull
docker compose build
docker compose up -d
```

The current schema is created idempotently by SQLAlchemy at startup. For a large evolving production system, the next engineering step would be adding Alembic migrations before making destructive schema changes.

## Backups

Example logical backup:

```bash
docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > fashioncart-backup.sql
```

Restore into an empty database using the corresponding `mysql` client command.

## HTTPS example with Caddy

Run Caddy on the host and proxy your domain to FashionCart's host port:

```text
fashioncart.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Do not expose the MySQL port publicly.

## Health endpoints

- `/health` — process health
- `/health/ready` — process + database readiness

The backend Docker health check uses `/health/ready`, and the frontend waits for the backend to become healthy before starting.

## Safety checks built into the stack

- Compose fails fast if `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, or `JWT_SECRET` are not configured.
- MySQL is private by default; only Nginx is published.
- Backend readiness waits for a live database query.
- Product deletion returns `409 PRODUCT_IN_USE` instead of leaking a database integrity error when historical orders reference the product.
- Demo credentials are never pre-filled in the login form; demo buttons only populate them intentionally.
