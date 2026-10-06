import io


def user_headers(client):
    r = client.post('/api/auth/login', json={'email': 'user@test.com', 'password': 'Password123'})
    return {'Authorization': f"Bearer {r.json()['access_token']}"}


def test_unauthenticated_products_rejected(client):
    r = client.get('/api/products')
    assert r.status_code == 401


def test_user_cannot_run_analysis(client):
    r = client.post('/api/analysis/run', json={'min_support': .1, 'min_confidence': .2, 'min_lift': 1}, headers=user_headers(client))
    assert r.status_code == 403


def test_invalid_analysis_parameters(client, analyst_headers):
    r = client.post('/api/analysis/run', json={'min_support': 0, 'min_confidence': 1.2, 'min_lift': 0}, headers=analyst_headers)
    assert r.status_code == 422
    assert r.json()['error']['code'] == 'VALIDATION_ERROR'


def test_missing_product(client, admin_headers):
    r = client.get('/api/products/999999', headers=admin_headers)
    assert r.status_code == 404
    assert r.json()['error']['code'] == 'PRODUCT_NOT_FOUND'


def test_invalid_product_category(client, admin_headers):
    r = client.post('/api/products', json={
        'product_name': 'Invalid Category Item',
        'category': 'RandomCategory',
        'price': 100,
        'stock_quantity': 1,
    }, headers=admin_headers)
    assert r.status_code == 422


def test_csv_missing_required_columns(client, analyst_headers):
    data = b'id,item\n1,T-Shirt\n'
    r = client.post('/api/transactions/upload', files={'file': ('tx.csv', io.BytesIO(data), 'text/csv')}, headers=analyst_headers)
    assert r.status_code == 400
    assert r.json()['error']['code'] == 'INVALID_CSV'


def test_recommendation_requires_analysis(client, admin_headers):
    r = client.get('/api/recommendations/T-Shirt', headers=admin_headers)
    assert r.status_code == 404
    assert r.json()['error']['code'] == 'NO_ANALYSIS'
