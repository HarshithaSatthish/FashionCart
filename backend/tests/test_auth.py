def test_login(client):
    r=client.post('/api/auth/login', json={'email':'user@test.com','password':'Password123'})
    assert r.status_code == 200
    assert r.json()['token_type'] == 'bearer'


def test_invalid_login(client):
    r=client.post('/api/auth/login', json={'email':'user@test.com','password':'wrong'})
    assert r.status_code == 401


def test_register_does_not_create_admin(client):
    r=client.post('/api/auth/register', json={'name':'Alice','email':'alice@example.com','password':'Password123'})
    assert r.status_code == 201
    assert r.json()['role'] == 'USER'


def test_admin_can_list_users(client, admin_headers):
    r = client.get('/api/users', headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body['total'] == 3
    assert {x['role'] for x in body['items']} == {'ADMIN', 'ANALYST', 'USER'}


def test_non_admin_cannot_list_users(client, analyst_headers):
    r = client.get('/api/users', headers=analyst_headers)
    assert r.status_code == 403


def test_admin_can_change_user_role(client, admin_headers):
    users = client.get('/api/users?search=user@test.com', headers=admin_headers).json()['items']
    target = users[0]
    r = client.put(
        f"/api/users/{target['id']}",
        headers=admin_headers,
        json={'role': 'ANALYST', 'is_active': True},
    )
    assert r.status_code == 200
    assert r.json()['role'] == 'ANALYST'


def test_admin_cannot_demote_self(client, admin_headers):
    admin = client.get('/api/users?search=admin@test.com', headers=admin_headers).json()['items'][0]
    r = client.put(
        f"/api/users/{admin['id']}",
        headers=admin_headers,
        json={'role': 'USER', 'is_active': True},
    )
    assert r.status_code == 409
    assert r.json()['error']['code'] == 'SELF_ROLE_CHANGE'
