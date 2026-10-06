import pytest
from app.core import rate_limit
from app.core.config import get_settings


@pytest.fixture
def limits_on():
    s = get_settings()
    s.rate_limit_enabled = True
    rate_limit.reset()
    yield
    s.rate_limit_enabled = False
    rate_limit.reset()


def test_login_is_rate_limited(client, limits_on):
    codes = [client.post('/api/auth/login', json={'email': 'x@test.com', 'password': 'wrongpass1'}).status_code for _ in range(12)]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429
    r = client.post('/api/auth/login', json={'email': 'x@test.com', 'password': 'wrongpass1'})
    assert r.status_code == 429 and r.headers.get('Retry-After')
    assert r.json()['error']['code'] == 'RATE_LIMITED'


def test_registration_can_be_disabled(client):
    s = get_settings()
    s.allow_registration = False
    try:
        r = client.post('/api/auth/register', json={'name': 'Nope', 'email': 'nope@test.com', 'password': 'Password123'})
        assert r.status_code == 403 and r.json()['error']['code'] == 'REGISTRATION_DISABLED'
    finally:
        s.allow_registration = True
