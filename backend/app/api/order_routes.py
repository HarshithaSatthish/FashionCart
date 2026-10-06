from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, selectinload
from app.core.database import get_db
from app.core.security import require_roles
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.user import User
from app.repositories.order_repository import OrderRepository
from app.schemas.order_schema import OrderCreate, OrderItemCreate, OrderResponse
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("", response_model=OrderResponse, status_code=201)
def create_order(data: OrderCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    return OrderService.create(db, data)


@router.get("", summary="List orders (paginated envelope)")
def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    customer_id: int | None = Query(None, gt=0),
    product_id: int | None = Query(None, gt=0),
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "ANALYST")),
):
    stmt = select(Order).options(selectinload(Order.items))
    if status:
        stmt = stmt.where(Order.status == status.upper())
    if customer_id:
        stmt = stmt.where(Order.customer_id == customer_id)
    if product_id:
        stmt = stmt.where(Order.id.in_(select(OrderItem.order_id).where(OrderItem.product_id == product_id)))
    if search and search.strip():
        term = search.strip()
        conds = [Order.customer_id.in_(select(Customer.id).where(Customer.name.ilike(f"%{term}%")))]
        if term.isdigit():
            conds.append(Order.id == int(term))
        stmt = stmt.where(or_(*conds))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.order_by(Order.id.desc()).offset((page - 1) * limit).limit(limit)).all()
    names = dict(db.execute(select(Customer.id, Customer.name).where(Customer.id.in_({r.customer_id for r in rows}))).all()) if rows else {}
    items = [{**OrderResponse.model_validate(x).model_dump(mode="json"), "customer_name": names.get(x.customer_id)} for x in rows]
    return {"items": items, "page": page, "limit": limit, "total": total}


@router.get("/stats", summary="Get order statistics")
def order_stats(db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    total = int(db.scalar(select(func.count(Order.id))) or 0)
    completed = int(db.scalar(select(func.count(Order.id)).where(Order.status == "COMPLETED")) or 0)
    pending = int(db.scalar(select(func.count(Order.id)).where(Order.status == "PENDING")) or 0)
    cancelled = int(db.scalar(select(func.count(Order.id)).where(Order.status == "CANCELLED")) or 0)
    return {"total": total, "completed": completed, "pending": pending, "cancelled": cancelled}


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    order = OrderRepository.get(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found"})
    return order


@router.post("/{order_id}/items", response_model=OrderResponse)
def add_item(order_id: int, data: OrderItemCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    order = OrderRepository.get(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found"})
    return OrderService.add_item(db, order, data)


customer_router = APIRouter(prefix="/customers", tags=["Orders"])


@customer_router.get("/{customer_id}/orders", response_model=list[OrderResponse])
def customer_orders(customer_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    if not db.get(Customer, customer_id):
        raise HTTPException(status_code=404, detail={"code": "CUSTOMER_NOT_FOUND", "message": "Customer not found"})
    return OrderRepository.by_customer(db, customer_id)
