# FashionCart Final Audit Report

## Verdict

This build is suitable for a portfolio, interview demonstration, college/project submission, Docker-based demo deployment, and the prepared Vercel + Cloudflare-DNS deployment after environment variables and a managed MySQL connection are configured.

It is intentionally described as **production-style**, not as a fully operated internet-scale production service. Before a long-lived internet-scale deployment, add database migrations (for example Alembic), automated backups, monitoring/alerting, a distributed rate limiter, and mature secret/credential rotation.

## What was rechecked

- ZIP/archive integrity and project structure
- Python syntax/import structure
- FastAPI application/OpenAPI generation
- Authentication/RBAC route wiring
- Product, customer, order, transaction, analysis, rule, dashboard, and recommendation APIs
- Apriori persistence and recommendation flow
- Seed data volume and meaningful purchase patterns
- Database-level filtering and order/stock behavior
- Product deletion behavior when historical orders reference a product
- Central error handling and auth response headers
- Frontend JavaScript syntax and backend endpoint wiring
- Responsive navigation and role-aware menu access
- Live notification/search behavior
- Docker/Nginx/MySQL configuration, Vercel entrypoint/configuration, serverless database pooling, and required environment secrets
- Postman/docs/schema/architecture/interview materials
- CI/test invocation portability
- Temporary artifacts, caches, and test databases

## Test results from the audit environment

- 28 backend tests passed using SQLite test mode.
- OpenAPI generation produced 28 paths / 34 operations with unique operation IDs.
- Seed verification produced 100 customers, 30 products, 550 orders, and 1,552 order items.
- Apriori integration on the seeded dataset produced 21 frequent itemsets and 28 association rules at the documented default thresholds.
- Python source compilation passed.
- Frontend JavaScript syntax checks passed.
- JSON/YAML parsing passed.

The audit environment could not download the declared `python-jose` / Passlib dependencies, so temporary test-only stand-ins were used to exercise application flows. Those stand-ins are **not** included in this project. The real deployment installs the pinned dependencies from `backend/requirements.txt`.

Docker is not installed in the audit workspace, so `docker compose up --build` could not be executed here. The Compose files, health checks, networking, required-secret interpolation, and Nginx proxy configuration were inspected and validated structurally.

A headless Chromium runtime check was attempted, but local/file navigation is blocked by the workspace policy. Frontend source syntax and API wiring were therefore checked statically; capture real runtime screenshots after starting the stack locally.

## Post-audit fix

- Demo account emails used the reserved `.local` domain, which the API's email validator rejects (HTTP 422), so seeded demo logins failed. Demo accounts now use `@fashioncart.dev`, and `tests/test_seed_accounts.py` guards against regression. Re-verified with real pinned dependencies: 38 tests pass; seed + Apriori produce 550 transactions / 21 itemsets / 28 rules.

## Hardening added after the audit

- In-memory rate limiting (login 10/min, register 5/min, upload 20/min per IP) with tests; `ALLOW_REGISTRATION` switch.
- Strict CSP on the static app; MIT LICENSE added.
- CI now includes a `docker-e2e` job that builds the real MySQL + API + Nginx stack, seeds it, and smoke-tests login -> Apriori -> recommendations. **This job is the first real Docker run of the project: confirm it is green after pushing.**

## Owner-review fixes (from the independent audit roadmap)

1. **Silent 100-row truncation (fixed).** Customers and orders now return the same `{items, page, limit, total}` envelope as products/users. Products, customers, orders, users and transactions use server-side pagination with a "Showing X-Y of Z" pager; search/sort/filter run on the server. Verified in jsdom: the Orders page shows 25 rows with a true total of 550 and navigates all 22 pages.
2. **USER role dead-end (fixed).** USERs get a purpose-built home (frequently-bought-together cards + pair finder) instead of a hollow admin dashboard, and the API no longer returns customer/order/transaction metrics to that role.
3. **Over-fetching removed.** Order detail loads only the one customer and the products in that order; product detail asks the API for that product's orders; notifications use `/products/stats`.
4. **Tested.** New backend tests cover pagination, order search/filter, stats and the USER payload; `frontend/tests/smoke.mjs` drives the real SPA against a live seeded backend (also run in CI through Nginx).

**Still open (documented, not hidden):** Apriori runs synchronously in the request (no job queue/progress stream), JWT is in localStorage with no refresh/revocation, schema is created on startup (no Alembic), and there are no charts yet. These are the next phases.

## Important fixes made during the final audit

- Product deletion now returns a clean `409 PRODUCT_IN_USE` when historical orders reference the product instead of causing a database integrity error.
- Order writes now use row locking where supported, explicit rollback handling, and prevent edits to cancelled orders.
- Cancelled orders do not consume stock.
- Association-rule product filtering is performed at database-query level.
- HTTP exception headers are preserved.
- Production JWT secret validation rejects weak/default secrets.
- Docker Compose now requires database and JWT secrets instead of silently using weak fallbacks.
- CI and local test commands use `python -m pytest` and include `pytest.ini` for reliable imports.
- Added end-to-end analysis persistence, product-delete regression, and cancelled-order stock tests.
- Removed auto-filled login credentials.
- Notifications use live backend state instead of static demo messages.
- Global search includes authorized customer lookup.
- Mobile navigation exposes secondary sections through a role-aware More menu.
- Product detail shows recent orders for authorized roles.
- Analysis detail supports JSON export.
- Registration includes password confirmation and strength feedback.
- Added ADMIN user-management APIs/UI with self-lockout and last-admin protection.
- Added API reference and Git commit plan documentation.


## Vercel + Cloudflare deployment adaptation (2026-10-06)

- Added root `index.py` as a Vercel-recognized FastAPI entrypoint without duplicating backend business logic.
- The existing frontend is mounted after API/health/docs routes, preserving same-origin `/api` calls.
- Added root `requirements.txt`, `.python-version`, `vercel.json`, `.vercelignore`, and `.env.vercel.example`.
- Replaced Docker-sized fixed SQLAlchemy pooling with environment-configurable serverless-safe defaults (`2 + 3` connections per warm instance by default).
- Added `VERCEL_CLOUDFLARE_DEPLOY.md` and a post-deploy smoke-check script.
- Cloudflare is documented as the external DNS provider with DNS-only records pointing to Vercel; this avoids an unnecessary double reverse proxy.
- A persistent managed MySQL service remains required; Vercel does not replace the database.

Static checks passed for the new deployment files, and a local route smoke check verified `/`, frontend assets, `/health`, `/health/ready`, and `/openapi.json` using SQLite. The audit container does not contain the pinned `python-jose`, Passlib, or bcrypt packages and has no Vercel CLI/network access, so a real Vercel build still has to be performed by Vercel with the declared dependencies.

## Before a real public production launch

1. Add Alembic or another formal schema migration workflow instead of relying on automatic table creation.
2. Put the deployment behind managed HTTPS and configure secure domain/CORS settings.
3. Add automated database backups, monitoring, metrics, and alerting.
4. Replace the current in-memory per-instance rate limiter with a distributed limiter (for example Redis-backed) if the service scales across many instances.
5. Store production secrets in a platform secret manager rather than a local `.env` file.
6. Capture real runtime screenshots after deploying and include them in the portfolio README if desired.

These are operational hardening steps, not blockers for the current portfolio/demo use case.
