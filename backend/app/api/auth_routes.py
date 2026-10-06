from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, verify_password, hash_password
from app.models.user import User
from app.schemas.auth_schema import (
    RegisterRequest, LoginRequest, UserResponse, TokenResponse,
    ProfileUpdateRequest, ChangePasswordRequest,
)
from app.services.auth_service import AuthService
from app.core.rate_limit import rate_limit
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=201, summary="Register a new user")
def register(data: RegisterRequest, db: Session = Depends(get_db), _: None = Depends(rate_limit("register", 5))):
    if not get_settings().allow_registration:
        raise HTTPException(status_code=403, detail={"code": "REGISTRATION_DISABLED", "message": "Registration is disabled"})
    return AuthService.register(db, data)


@router.post("/login", response_model=TokenResponse, summary="Login and receive a JWT")
def login(data: LoginRequest, db: Session = Depends(get_db), _: None = Depends(rate_limit("login", 10))):
    token, user = AuthService.login(db, data)
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserResponse, summary="Get the authenticated user")
def me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserResponse, summary="Update profile")
def update_me(data: ProfileUpdateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    email = data.email.lower()
    existing = db.scalar(select(User).where(User.email == email, User.id != user.id))
    if existing:
        raise HTTPException(status_code=409, detail={"code": "EMAIL_EXISTS", "message": "Email is already registered"})
    user.name = data.name.strip()
    user.email = email
    db.commit(); db.refresh(user)
    return user


@router.post("/change-password", summary="Change current user's password")
def change_password(data: ChangePasswordRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail={"code": "INVALID_CURRENT_PASSWORD", "message": "Current password is incorrect"})
    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail={"code": "PASSWORD_REUSED", "message": "New password must be different"})
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"success": True, "message": "Password changed"}
