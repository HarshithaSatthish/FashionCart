def test_order_creation_calculates_total(client, admin_headers):
    c=client.post('/api/customers',json={'name':'Bob','email':'bob@example.com','age':30},headers=admin_headers).json()
    p=client.post('/api/products',json={'product_name':'Jeans X','category':'Jeans','price':1500,'stock_quantity':10},headers=admin_headers).json()
    r=client.post('/api/orders',json={'customer_id':c['id'],'items':[{'product_id':p['id'],'quantity':2}]},headers=admin_headers)
    assert r.status_code==201
    assert r.json()['total_amount']=='3000.00'
