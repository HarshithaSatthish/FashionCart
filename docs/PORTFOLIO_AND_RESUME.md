# Portfolio & Resume Kit

## Resume bullets (pick 2-3)
- Built **FashionCart**, a full-stack purchase-pattern analytics platform (FastAPI, SQLAlchemy, MySQL 8, Nginx, Docker Compose) that mines co-purchase behaviour with a from-scratch **Apriori** engine and serves lift-ranked product recommendations from persisted rules.
- Designed a layered backend (routes -> services -> repositories) with **JWT auth, ADMIN/ANALYST/USER RBAC**, server-side stock/order validation with row locking, CSV import validation, login/upload **rate limiting**, and consistent error envelopes.
- Shipped **38 backend tests + a frontend smoke test (real SPA in jsdom, every role)** and a GitHub Actions pipeline that runs unit tests, JS syntax checks, and a full **Docker end-to-end smoke test** (MySQL + API + Nginx: login -> Apriori -> recommendations).

## One-line description (GitHub / LinkedIn)
Purchase-intelligence platform for fashion retail: FastAPI + MySQL + Apriori association-rule mining, JWT RBAC, Dockerised with Nginx.

## 30-second pitch
See `INTERVIEW_DEMO.md`.

## Honest scope statement (say this before they ask)
Production-style, not internet-scale: schema is created on startup (no Alembic yet), rate limiting is in-memory (single process), Apriori runs synchronously, JWTs are stored in localStorage. I know the upgrade path for each (Alembic, Redis limiter, background worker, httpOnly cookies).

## Likely interview questions
1. **Why persist rules instead of computing per request?** Mining is the expensive step; recommendations are frequent reads, so they become indexed DB lookups.
2. **Why lift-first ranking?** Confidence is inflated by popular items; lift corrects for base popularity.
3. **How do you prevent overselling?** Order writes validate stock server-side under row locks, with rollback on failure; cancelled orders don't consume stock.
4. **How would you scale Apriori?** Background job queue, FP-Growth, or sampling; cap itemset size.
5. **Biggest security gaps?** Open registration (toggle: `ALLOW_REGISTRATION=false`), localStorage tokens, in-memory limiter.

## Launch checklist
- [ ] Push to GitHub using `docs/GIT_COMMIT_PLAN.md`; confirm the CI badge/run is green (including `docker-e2e` and the frontend smoke test)
- [ ] Deploy on a VPS or Docker host with HTTPS; set `ALLOW_REGISTRATION=false` for a public demo
- [ ] Run the seed once, log in as each role, click through every page
- [ ] Take 5 real screenshots (dashboard, analysis, rules drawer, recommendations, mobile view) into `docs/screenshots/` and embed them at the top of the README
- [ ] Record a 60-90s screen capture of the demo flow
- [ ] Put the live URL + repo link on resume, LinkedIn and portfolio site
