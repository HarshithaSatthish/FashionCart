from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User
from app.schemas.auth_schema import AdminUserResponse, AdminUserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", summary="List application users (ADMIN only)")
def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    role: str | None = Query(None, pattern="^(ADMIN|ANALYST|USER)$"),
    active: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN")),
):
    conditions = []
    if search:
        needle = f"%{search.strip()}%"
        conditions.append(or_(User.name.ilike(needle), User.email.ilike(needle)))
    if role:
        conditions.append(User.role == role)
    if active is not None:
        conditions.append(User.is_active == active)

    stmt = select(User)
    count_stmt = select(func.count(User.id))
    if conditions:
        stmt = stmt.where(*conditions)
        count_stmt = count_stmt.where(*conditions)
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(stmt.order_by(User.id).offset((page - 1) * limit).limit(limit)).all()
    return {
        "items": [AdminUserResponse.model_validate(user) for user in rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


@router.put("/{user_id}", response_model=AdminUserResponse, summary="Change a user's role or active status")
def update_user(
    user_id: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("ADMIN")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail={"code": "USER_NOT_FOUND", "message": "User not found"})

    # Keep the current administrator from accidentally locking themselves out.
    if user.id == admin.id and (data.role != user.role or data.is_active != user.is_active):
        raise HTTPException(
            status_code=409,
            detail={"code": "SELF_ROLE_CHANGE", "message": "Use another administrator to change your own role or active status"},
        )

    # Never allow the final active admin account to be removed from service.
    removing_admin = user.role == "ADMIN" and user.is_active and (data.role != "ADMIN" or not data.is_active)
    if removing_admin:
        active_admins = int(
            db.scalar(select(func.count(User.id)).where(User.role == "ADMIN", User.is_active.is_(True))) or 0
        )
        if active_admins <= 1:
            raise HTTPException(
                status_code=409,
                detail={"code": "LAST_ADMIN", "message": "At least one active administrator must remain"},
            )

    user.role = data.role
    user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return user
