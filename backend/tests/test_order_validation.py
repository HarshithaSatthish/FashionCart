def _customer_and_product(client, admin_headers, stock=1):
    customer = client.post('/api/customers', json={'name': 'Buyer', 'email': f'buyer{stock}@example.com', 'age': 25}, headers=admin_headers).json()
    product = client.post('/api/products', json={
        'product_name': f'Test Product {stock}',
        'category': 'T-Shirts',
        'price': 500,
        'stock_quantity': stock,
    }, headers=admin_headers).json()
    return customer, product


def test_insufficient_stock(client, admin_headers):
    customer, product = _customer_and_product(client, admin_headers, stock=1)
    r = client.post('/api/orders', json={
        'customer_id': customer['id'],
        'items': [{'product_id': product['id'], 'quantity': 2}],
    }, headers=admin_headers)
    assert r.status_code == 409
    assert r.json()['error']['code'] == 'INSUFFICIENT_STOCK'


def test_duplicate_order_item(client, admin_headers):
    customer, product = _customer_and_product(client, admin_headers, stock=5)
    r = client.post('/api/orders', json={
        'customer_id': customer['id'],
        'items': [
            {'product_id': product['id'], 'quantity': 1},
            {'product_id': product['id'], 'quantity': 1},
        ],
    }, headers=admin_headers)
    assert r.status_code == 409
    assert r.json()['error']['code'] == 'DUPLICATE_ORDER_ITEM'


def test_cancelled_order_does_not_consume_stock_and_cannot_be_modified(client, admin_headers):
    customer, product = _customer_and_product(client, admin_headers, stock=3)
    created = client.post('/api/orders', json={
        'customer_id': customer['id'],
        'items': [{'product_id': product['id'], 'quantity': 2}],
        'status': 'CANCELLED',
    }, headers=admin_headers)
    assert created.status_code == 201
    refreshed = client.get(f"/api/products/{product['id']}", headers=admin_headers)
    assert refreshed.json()['stock_quantity'] == 3
    added = client.post(f"/api/orders/{created.json()['id']}/items", json={
        'product_id': product['id'], 'quantity': 1,
    }, headers=admin_headers)
    assert added.status_code == 409
    assert added.json()['error']['code'] == 'ORDER_NOT_EDITABLE'
