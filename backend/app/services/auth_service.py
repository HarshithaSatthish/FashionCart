import logging
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth_schema import RegisterRequest, LoginRequest

logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def register(db: Session, data: RegisterRequest) -> User:
        if db.scalar(select(User).where(User.email == data.email.lower())):
            raise HTTPException(status_code=409, detail={"code": "EMAIL_EXISTS", "message": "Email is already registered"})
        user = User(name=data.name.strip(), email=data.email.lower(), password_hash=hash_password(data.password), role="USER")
        db.add(user); db.commit(); db.refresh(user)
        return user

    @staticmethod
    def login(db: Session, data: LoginRequest):
        user = db.scalar(select(User).where(User.email == data.email.lower()))
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"})
        logger.info("User login user_id=%s role=%s", user.id, user.role)
        return create_access_token(str(user.id)), user
