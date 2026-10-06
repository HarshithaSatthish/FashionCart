import io


def test_profile_update_and_password_change(client):
    login = client.post('/api/auth/login', json={'email':'user@test.com','password':'Password123'})
    headers = {'Authorization': f"Bearer {login.json()['access_token']}"}
    updated = client.put('/api/auth/me', json={'name':'Updated User','email':'updated@test.com'}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()['name'] == 'Updated User'
    changed = client.post('/api/auth/change-password', json={'current_password':'Password123','new_password':'NewPassword123'}, headers=headers)
    assert changed.status_code == 200
    relogin = client.post('/api/auth/login', json={'email':'updated@test.com','password':'NewPassword123'})
    assert relogin.status_code == 200


def test_transaction_list_and_stats(client, analyst_headers):
    data=b'transaction_id,product\n1001,T-Shirt\n1001,Jeans\n1002,Dress\n1002,Handbag\n'
    uploaded=client.post('/api/transactions/upload',files={'file':('tx.csv',io.BytesIO(data),'text/csv')},headers=analyst_headers)
    assert uploaded.status_code == 200
    listing=client.get('/api/transactions?limit=10',headers=analyst_headers)
    assert listing.status_code == 200
    assert listing.json()['total'] == 2
    assert {x['transaction_id'] for x in listing.json()['items']} == {'1001','1002'}
    stats=client.get('/api/transactions/stats',headers=analyst_headers)
    assert stats.status_code == 200
    assert stats.json()['transactions'] == 2
    assert stats.json()['rows'] == 4
