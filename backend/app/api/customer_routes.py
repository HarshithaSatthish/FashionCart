from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_roles
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer_schema import CustomerCreate, CustomerResponse

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(data: CustomerCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    if db.scalar(select(Customer).where(Customer.email == data.email.lower())):
        raise HTTPException(status_code=409, detail={"code": "CUSTOMER_EMAIL_EXISTS", "message": "Customer email already exists"})
    customer = Customer(**data.model_dump(exclude={"email"}), email=data.email.lower())
    db.add(customer); db.commit(); db.refresh(customer)
    return customer


@router.get("", summary="List customers (paginated envelope)")
def list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "ANALYST")),
):
    stmt = select(Customer)
    if search:
        needle = f"%{search.strip()}%"
        stmt = stmt.where(or_(Customer.name.ilike(needle), Customer.email.ilike(needle)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Customer.id).offset((page - 1) * limit).limit(limit)).all()
    return {"items": [CustomerResponse.model_validate(x) for x in rows], "page": page, "limit": limit, "total": total}


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail={"code": "CUSTOMER_NOT_FOUND", "message": "Customer not found"})
    return customer
