from sqlalchemy import select, func, asc, desc
from sqlalchemy.orm import Session
from app.models.product import Product


class ProductRepository:
    @staticmethod
    def get(db: Session, product_id: int) -> Product | None:
        return db.get(Product, product_id)

    @staticmethod
    def list(db: Session, *, page: int, limit: int, search: str | None, category: str | None,
             min_price: float | None, max_price: float | None, sort_by: str, sort_order: str):
        stmt = select(Product)
        count_stmt = select(func.count(Product.id))
        conditions = []
        if search:
            conditions.append(Product.product_name.ilike(f"%{search}%"))
        if category:
            conditions.append(Product.category == category)
        if min_price is not None:
            conditions.append(Product.price >= min_price)
        if max_price is not None:
            conditions.append(Product.price <= max_price)
        if conditions:
            stmt = stmt.where(*conditions)
            count_stmt = count_stmt.where(*conditions)
        allowed = {"id": Product.id, "name": Product.product_name, "price": Product.price, "category": Product.category, "stock": Product.stock_quantity}
        sort_col = allowed.get(sort_by, Product.id)
        stmt = stmt.order_by(desc(sort_col) if sort_order.lower() == "desc" else asc(sort_col))
        total = db.scalar(count_stmt) or 0
        items = db.scalars(stmt.offset((page - 1) * limit).limit(limit)).all()
        return items, total
