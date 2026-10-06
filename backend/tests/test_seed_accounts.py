import re
from app.schemas.auth_schema import LoginRequest


def test_seeded_demo_emails_pass_login_validation():
    src = open("scripts/seed.py").read()
    emails = re.findall(r'"([\w.]+@[\w.]+)", "', src)
    assert len(emails) == 3
    for email in emails:
        LoginRequest(email=email, password="x")
