from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models.order import Order


class OrderRepository:
    @staticmethod
    def get(db: Session, order_id: int) -> Order | None:
        return db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))

    @staticmethod
    def list(db: Session, page: int, limit: int):
        return db.scalars(select(Order).options(selectinload(Order.items)).order_by(Order.id.desc()).offset((page-1)*limit).limit(limit)).all()

    @staticmethod
    def by_customer(db: Session, customer_id: int):
        return db.scalars(select(Order).options(selectinload(Order.items)).where(Order.customer_id == customer_id).order_by(Order.id.desc())).all()
