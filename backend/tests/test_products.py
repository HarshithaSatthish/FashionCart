def test_product_crud(client, admin_headers):
    payload={'product_name':'Test Tee','category':'T-Shirts','price':999,'stock_quantity':10}
    r=client.post('/api/products',json=payload,headers=admin_headers); assert r.status_code==201
    pid=r.json()['id']
    r=client.get(f'/api/products/{pid}',headers=admin_headers); assert r.status_code==200
    r=client.put(f'/api/products/{pid}',json={'price':1099},headers=admin_headers); assert r.json()['price']=='1099.00'
    r=client.delete(f'/api/products/{pid}',headers=admin_headers); assert r.status_code==204


def test_user_cannot_create_product(client):
    t=client.post('/api/auth/login',json={'email':'user@test.com','password':'Password123'}).json()['access_token']
    r=client.post('/api/products',json={'product_name':'X Tee','category':'T-Shirts','price':500,'stock_quantity':2},headers={'Authorization':f'Bearer {t}'})
    assert r.status_code==403


def test_delete_product_in_historical_order_returns_conflict(client, admin_headers):
    customer = client.post('/api/customers', json={'name':'History Buyer','email':'history@example.com'}, headers=admin_headers).json()
    product = client.post('/api/products', json={'product_name':'History Tee','category':'T-Shirts','price':700,'stock_quantity':5}, headers=admin_headers).json()
    created = client.post('/api/orders', json={'customer_id':customer['id'],'items':[{'product_id':product['id'],'quantity':1}]}, headers=admin_headers)
    assert created.status_code == 201
    deleted = client.delete(f"/api/products/{product['id']}", headers=admin_headers)
    assert deleted.status_code == 409
    assert deleted.json()['error']['code'] == 'PRODUCT_IN_USE'
