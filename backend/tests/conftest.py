import os
os.environ["DATABASE_URL"] = "sqlite:///./test_fashioncart.db"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient
from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models.user import User

@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db=SessionLocal()
    db.add_all([
        User(name="Admin", email="admin@test.com", password_hash=hash_password("Password123"), role="ADMIN"),
        User(name="Analyst", email="analyst@test.com", password_hash=hash_password("Password123"), role="ANALYST"),
        User(name="User", email="user@test.com", password_hash=hash_password("Password123"), role="USER"),
    ])
    db.commit(); db.close()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(): return TestClient(app)

@pytest.fixture
def admin_headers(client):
    r=client.post('/api/auth/login', json={'email':'admin@test.com','password':'Password123'})
    return {'Authorization': f"Bearer {r.json()['access_token']}"}

@pytest.fixture
def analyst_headers(client):
    r=client.post('/api/auth/login', json={'email':'analyst@test.com','password':'Password123'})
    return {'Authorization': f"Bearer {r.json()['access_token']}"}
