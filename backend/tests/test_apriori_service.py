from app.algorithms.apriori_engine import AprioriEngine


def test_apriori_expected_rule():
    tx=[['T-Shirt','Jeans','Sneakers'],['T-Shirt','Jeans'],['Dress','Handbag'],['T-Shirt','Jeans','Sneakers']]
    itemsets,rules=AprioriEngine().run(tx, min_support=0.5, min_confidence=0.6, min_lift=1.0)
    pairs={ (r.antecedent,r.consequent):r for r in rules }
    assert (('T-Shirt',),('Jeans',)) in pairs
    assert pairs[(('T-Shirt',),('Jeans',))].confidence == 1.0


def test_empty_transactions():
    assert AprioriEngine().run([],0.1,0.1,1.0) == ([],[])


def test_analysis_endpoint_persists_itemsets_and_rules(client, admin_headers):
    customer = client.post('/api/customers', json={'name':'Apriori Buyer','email':'apriori@example.com'}, headers=admin_headers).json()
    tee = client.post('/api/products', json={'product_name':'Apriori Tee','category':'T-Shirts','price':500,'stock_quantity':20}, headers=admin_headers).json()
    jeans = client.post('/api/products', json={'product_name':'Apriori Jeans','category':'Jeans','price':1000,'stock_quantity':20}, headers=admin_headers).json()
    for _ in range(3):
        r = client.post('/api/orders', json={'customer_id':customer['id'],'items':[{'product_id':tee['id'],'quantity':1},{'product_id':jeans['id'],'quantity':1}]}, headers=admin_headers)
        assert r.status_code == 201
    run = client.post('/api/analysis/run', json={'min_support':0.5,'min_confidence':0.5,'min_lift':1.0}, headers=admin_headers)
    assert run.status_code == 200
    body = run.json()
    assert body['status'] == 'completed'
    assert body['transaction_count'] == 3
    assert body['frequent_itemsets'] >= 3
    detail = client.get(f"/api/analysis/{body['analysis_id']}", headers=admin_headers)
    rules = client.get(f"/api/analysis/{body['analysis_id']}/rules", headers=admin_headers)
    itemsets = client.get(f"/api/analysis/{body['analysis_id']}/itemsets", headers=admin_headers)
    assert detail.status_code == 200
    assert rules.status_code == 200 and len(rules.json()) >= 2
    assert itemsets.status_code == 200 and len(itemsets.json()) >= 3
