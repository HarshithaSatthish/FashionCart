# Frontend smoke test

Runs the real single-page app in jsdom against a live, **seeded** backend and walks every role:

- Orders/customers/products: 25-row pages, true totals (550 orders), next/last, server-side sort/filter/search
- Detail pages, users admin, transactions, analysis, rules, recommendations: render with no runtime errors
- USER role: purpose-built home, no admin KPIs, pair finder (including the empty state)

```bash
# backend running + seeded (see main README)
cd frontend/tests && npm install && npm run smoke
# or through Nginx in Docker:
API_URL=http://localhost:3000/api npm run smoke
```
