def _make_customers(client, headers, n):
    for i in range(n):
        r = client.post('/api/customers', json={'name': f'Pager {i}', 'email': f'pager{i}@example.com'}, headers=headers)
        assert r.status_code == 201


def test_customers_envelope_and_paging(client, admin_headers):
    _make_customers(client, admin_headers, 7)
    p1 = client.get('/api/customers?limit=3&page=1', headers=admin_headers).json()
    p3 = client.get('/api/customers?limit=3&page=3', headers=admin_headers).json()
    assert p1['total'] >= 7 and len(p1['items']) == 3 and p1['page'] == 1 and p1['limit'] == 3
    assert len(p3['items']) >= 1
    ids = [c['id'] for c in client.get('/api/customers?limit=100', headers=admin_headers).json()['items']]
    assert ids == sorted(ids) and len(ids) == p1['total']


def test_customer_search_total_counts_matches_only(client, admin_headers):
    _make_customers(client, admin_headers, 4)
    r = client.get('/api/customers?search=pager&limit=2', headers=admin_headers).json()
    assert r['total'] == 4 and len(r['items']) == 2


def test_orders_envelope_has_total(client, admin_headers):
    r = client.get('/api/orders?limit=5', headers=admin_headers)
    body = r.json()
    assert r.status_code == 200 and set(body) >= {'items', 'page', 'limit', 'total'}
    assert body['total'] >= len(body['items'])


def test_orders_filter_by_product_search_and_customer_name(client, admin_headers):
    cust = client.post('/api/customers', json={'name': 'Zelda Searchable', 'email': 'zelda@example.com'}, headers=admin_headers).json()
    prod = client.post('/api/products', json={'product_name': 'Filter Tee', 'category': 'T-Shirts', 'price': 10, 'stock_quantity': 50}, headers=admin_headers).json()
    o = client.post('/api/orders', json={'customer_id': cust['id'], 'items': [{'product_id': prod['id'], 'quantity': 1}]}, headers=admin_headers).json()
    by_product = client.get(f"/api/orders?product_id={prod['id']}", headers=admin_headers).json()
    assert by_product['total'] == 1 and by_product['items'][0]['id'] == o['id']
    by_name = client.get('/api/orders?search=zelda', headers=admin_headers).json()
    assert by_name['total'] == 1 and by_name['items'][0]['customer_name'] == 'Zelda Searchable'
    by_id = client.get(f"/api/orders?search={o['id']}", headers=admin_headers).json()
    assert any(x['id'] == o['id'] for x in by_id['items'])


def test_product_stats_counts(client, admin_headers):
    base = client.get('/api/products/stats', headers=admin_headers).json()
    client.post('/api/products', json={'product_name': 'Stats Out', 'category': 'T-Shirts', 'price': 5, 'stock_quantity': 0}, headers=admin_headers)
    client.post('/api/products', json={'product_name': 'Stats Low', 'category': 'T-Shirts', 'price': 5, 'stock_quantity': 3}, headers=admin_headers)
    after = client.get('/api/products/stats', headers=admin_headers).json()
    assert after['total'] == base['total'] + 2
    assert after['out_of_stock'] == base['out_of_stock'] + 1 and after['low_stock'] == base['low_stock'] + 1
