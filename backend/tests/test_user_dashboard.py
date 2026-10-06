def _user_headers(client):
    client.post('/api/auth/register', json={'name': 'Shopper One', 'email': 'shopper1@example.com', 'password': 'Password123'})
    t = client.post('/api/auth/login', json={'email': 'shopper1@example.com', 'password': 'Password123'}).json()['access_token']
    return {'Authorization': f'Bearer {t}'}


def test_user_dashboard_hides_business_metrics(client):
    r = client.get('/api/dashboard', headers=_user_headers(client))
    assert r.status_code == 200
    body = r.json()
    assert 'highest_lift_rules' in body and 'total_products' in body
    for leaked in ('total_customers', 'total_orders', 'total_transactions', 'imported_transactions'):
        assert leaked not in body


def test_analyst_dashboard_keeps_business_metrics(client, analyst_headers):
    body = client.get('/api/dashboard', headers=analyst_headers).json()
    assert {'total_customers', 'total_orders', 'total_transactions'} <= set(body)
