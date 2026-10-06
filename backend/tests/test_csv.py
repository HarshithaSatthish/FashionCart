import io

def test_csv_validation(client, analyst_headers):
    data=b'transaction_id,product\n1001,T-Shirt\n1001,Jeans\n1001,Jeans\n'
    r=client.post('/api/transactions/upload',files={'file':('tx.csv',io.BytesIO(data),'text/csv')},headers=analyst_headers)
    assert r.status_code==200
    assert r.json()['valid_rows']==2
    assert r.json()['duplicate_rows']==1
