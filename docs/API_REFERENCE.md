# FashionCart API Reference

Base path: `/api`

Authentication uses `Authorization: Bearer <token>` except for register/login.

## Authentication

| Method | Path | Access | Success | Main errors | Purpose |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | 201 | 403, 409, 422, 429 | Create a USER account |
| POST | `/auth/login` | Public | 200 | 401, 422, 429 | Authenticate and receive JWT |
| GET | `/auth/me` | Authenticated | 200 | 401 | Current profile |
| PUT | `/auth/me` | Authenticated | 200 | 401, 409, 422 | Update name/email |
| POST | `/auth/change-password` | Authenticated | 200 | 400, 401, 422 | Change password |

### Login request
```json
{"email":"analyst@fashioncart.dev","password":"Analyst@123"}
```

### Login response
```json
{
  "access_token":"<jwt>",
  "token_type":"bearer",
  "user":{"id":2,"name":"FashionCart Analyst","email":"analyst@fashioncart.dev","role":"ANALYST"}
}
```

## Products

| Method | Path | Access | Success | Main errors |
|---|---|---|---|---|
| POST | `/products` | ADMIN | 201 | 401, 403, 422 |
| GET | `/products` | Authenticated | 200 | 401, 422 |
| GET | `/products/{id}` | Authenticated | 200 | 401, 404 |
| PUT | `/products/{id}` | ADMIN | 200 | 401, 403, 404, 422 |
| DELETE | `/products/{id}` | ADMIN | 204 | 401, 403, 404, 409 |

List filters: `page`, `limit`, `search`, `category`, `min_price`, `max_price`, `sort_by`, `sort_order`.

Deletion returns `409 PRODUCT_IN_USE` when historical orders reference a product.

## Customers

| Method | Path | Access | Success | Main errors |
|---|---|---|---|---|
| POST | `/customers` | ADMIN / ANALYST | 201 | 401, 403, 409, 422 |
| GET | `/customers` | ADMIN / ANALYST | 200 | 401, 403, 422 |
| GET | `/customers/{id}` | ADMIN / ANALYST | 200 | 401, 403, 404 |
| GET | `/customers/{id}/orders` | ADMIN / ANALYST | 200 | 401, 403, 404 |

## Orders

| Method | Path | Access | Success | Main errors |
|---|---|---|---|---|
| POST | `/orders` | ADMIN / ANALYST | 201 | 401, 403, 404, 409, 422 |
| GET | `/orders` | ADMIN / ANALYST | 200 | 401, 403, 422 |
| GET | `/orders/stats` | ADMIN / ANALYST | 200 | 401, 403 |
| GET | `/orders/{id}` | ADMIN / ANALYST | 200 | 401, 403, 404 |
| POST | `/orders/{id}/items` | ADMIN / ANALYST | 200 | 401, 403, 404, 409, 422 |

### Create order request
```json
{
  "customer_id": 1,
  "items": [
    {"product_id": 1, "quantity": 1},
    {"product_id": 3, "quantity": 1}
  ],
  "status": "COMPLETED"
}
```

The backend validates stock and calculates the authoritative total.

## Transactions

| Method | Path | Access | Success | Main errors |
|---|---|---|---|---|
| POST | `/transactions/upload` | ADMIN / ANALYST | 200 | 400, 401, 403, 422, 429 |
| GET | `/transactions` | ADMIN / ANALYST | 200 | 401, 403, 422 |
| GET | `/transactions/stats` | ADMIN / ANALYST | 200 | 401, 403 |

Upload accepts a CSV up to 10 MB with columns:

```csv
transaction_id,product
1001,Classic T-Shirt
1001,Slim Jeans
```

### Import response
```json
{"total_rows":5000,"valid_rows":4872,"invalid_rows":128,"duplicate_rows":25,"status":"completed"}
```

## Apriori analysis

| Method | Path | Access | Success | Main errors |
|---|---|---|---|---|
| POST | `/analysis/run` | ADMIN / ANALYST | 200 | 400, 401, 403, 422 |
| GET | `/analysis` | ADMIN / ANALYST | 200 | 401, 403 |
| GET | `/analysis/{id}` | ADMIN / ANALYST | 200 | 401, 403, 404 |
| GET | `/analysis/{id}/rules` | ADMIN / ANALYST | 200 | 401, 403, 404, 422 |
| GET | `/analysis/{id}/itemsets` | ADMIN / ANALYST | 200 | 401, 403, 404 |

### Run request
```json
{"min_support":0.05,"min_confidence":0.30,"min_lift":1.0}
```

### Run response
```json
{"analysis_id":12,"transaction_count":550,"frequent_itemsets":21,"association_rules":28,"execution_time_ms":438,"status":"completed"}
```

Rule filters: `min_lift`, `min_confidence`, `product`, `sort_by` (`lift`, `confidence`, `support`).

## Recommendations

| Method | Path | Access | Success | Main errors |
|---|---|---|---|---|
| GET | `/recommendations/{product_name}` | Authenticated | 200 | 401, 404 |
| POST | `/recommendations` | Authenticated | 200 | 401, 404, 422 |

Recommendations reuse the latest persisted analysis rules and are ranked by lift, confidence and support.

### Basket request
```json
{"items":["Classic T-Shirt","Slim Jeans"]}
```

## Dashboard

| Method | Path | Access | Success | Main errors |
|---|---|---|---|---|
| GET | `/dashboard` | Authenticated | 200 | 401 |

Returns customer/product/order/transaction totals plus the latest itemset/rule metrics and top association rule.

## Error envelope

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product with ID 25 was not found"
  }
}
```

Common status codes: `400`, `401`, `403`, `404`, `409`, `422`, `500`.

## Admin user management

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/users` | ADMIN | Paginated user search/filter with role and active-state filters |
| PUT | `/api/users/{user_id}` | ADMIN | Change role/active state; protects the current session and final active admin |

Example update:

```json
{
  "role": "ANALYST",
  "is_active": true
}
```

## Pagination & list envelopes

Every list endpoint (`/products`, `/customers`, `/orders`, `/users`, `/transactions`) returns the same envelope and accepts `page` (>=1) and `limit` (1-100, default 20):

```json
{ "items": [ ... ], "page": 2, "limit": 25, "total": 550 }
```

`total` counts all rows matching the active filters, so clients can render "Showing 26-50 of 550". The web app uses server-side paging, search, sort and filtering; it never fetches a whole table to filter in the browser.

| Endpoint | Added | Notes |
|---|---|---|
| `GET /products/stats` | any authenticated user | `total`, `categories`, `low_stock`, `out_of_stock` (powers the summary bar and notifications without loading the catalog) |
| `GET /orders?search=` | ADMIN / ANALYST | matches order id or customer name |
| `GET /orders?product_id=` | ADMIN / ANALYST | orders containing a product (product detail "recent orders") |
| `GET /orders` items | ADMIN / ANALYST | each item includes `customer_name` |
| `GET /dashboard` (role USER) | USER | catalog-level payload only (`total_products`, `association_rules`, `highest_lift_rules`, `top_rule`); customer/order/transaction metrics are not returned |

