# UI ↔ API Map

| UI | API |
|---|---|
| Login | `POST /api/auth/login` |
| Register | `POST /api/auth/register` |
| Profile | `GET/PUT /api/auth/me`, `POST /api/auth/change-password` |
| Dashboard | `GET /api/dashboard`, `GET /api/analysis` |
| Products | `GET/POST/PUT/DELETE /api/products...` |
| Customers | `GET/POST /api/customers`, `GET /api/customers/{id}/orders` |
| Orders | `GET/POST /api/orders`, `GET /api/orders/stats` |
| Transactions | `GET /api/transactions`, `GET /api/transactions/stats`, `POST /api/transactions/upload` |
| Apriori | `POST /api/analysis/run`, analysis history/detail/itemsets |
| Rules | `GET /api/analysis/{id}/rules` |
| Recommendations | `GET/POST /api/recommendations...` |

The frontend defaults to same-origin `/api`, and Nginx forwards that path to the backend container.


## Final audited interactions

| UI interaction | Data source / behavior |
|---|---|
| Global search | Products + permitted customers; numeric order lookup |
| Notifications | Live dashboard/analysis/inventory state, not hard-coded messages |
| Mobile More | Customers, Orders, Transactions, Rules, Profile according to RBAC |
| Analysis Export | Downloads the loaded analysis, rules and itemsets as JSON |
| Delete Product | Returns a clear 409 conflict if historical orders reference it |
