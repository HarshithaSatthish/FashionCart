# FashionCart Interview Demo Script

## 30-second opening
FashionCart is a deployment-ready purchase-intelligence platform built around FastAPI, MySQL and Apriori. The normal commerce workflow—users, products, customers and orders—is persisted relationally. Completed orders and imported CSV history are converted into transaction baskets. A reusable Apriori engine discovers frequent itemsets and association rules, and those results are persisted so recommendation requests reuse stored rules instead of rerunning mining on every request. The Stitch-inspired frontend is wired to the real APIs through a same-origin Nginx proxy.

## 5-minute UI demonstration
1. Sign in with the **Analyst** demo account.
2. On **Dashboard**, point out transaction count, strongest association, average support/confidence and latest analysis.
3. Open **Transactions**, upload `data/sample_transactions.csv`, and show the import summary.
4. Open **Apriori Analysis**, keep support `0.05`, confidence `0.30`, lift `1.0`, and click **Run Analysis**.
5. Open the completed analysis and explain the top rule using support, confidence and lift.
6. Open **Association Rules**, filter by lift/confidence, then click **Inspect** to show the rule drawer.
7. Open **Recommendations**, select `Classic T-Shirt`, and show the lift-first ranking. Switch to **Basket** mode for multi-item input.
8. Sign in as **Admin** and show product create/edit/delete plus order creation and stock validation.
9. Finish in Swagger at `/docs` to show the typed REST contract.

## Apriori explanation
Apriori uses the downward-closure property: if an itemset is frequent, all of its subsets must also be frequent. The engine grows candidate sets level by level, prunes impossible candidates, calculates support for frequent itemsets, and generates association rules that meet the confidence and lift thresholds.

## Metrics
- **Support** — how often the full combination appears in all baskets.
- **Confidence** — how often the consequent appears when the antecedent appears.
- **Lift** — how much stronger the relationship is than random co-occurrence. Lift above 1 indicates a positive association.

## Why persist rules?
Mining is the expensive phase, while recommendation reads are frequent. FashionCart stores each completed analysis and its rules in MySQL. Recommendation requests become inexpensive database reads and ranking rather than repeated Apriori executions.

## Engineering points to mention
- JWT authentication and ADMIN / ANALYST / USER RBAC
- Pydantic validation and consistent error responses
- Repository/service separation
- Server-side order totals and stock enforcement
- Database indexes and connection pooling
- CSV validation and duplicate handling
- Persisted model outputs
- Nginx same-origin reverse proxy
- Docker health checks and private MySQL networking
- Automated backend tests
