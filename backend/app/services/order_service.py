from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.schemas.order_schema import OrderCreate, OrderItemCreate


class OrderService:
    @staticmethod
    def create(db: Session, data: OrderCreate) -> Order:
        try:
            if not db.get(Customer, data.customer_id):
                raise HTTPException(status_code=404, detail={"code": "CUSTOMER_NOT_FOUND", "message": "Customer not found"})
            ids = [i.product_id for i in data.items]
            if len(ids) != len(set(ids)):
                raise HTTPException(status_code=409, detail={"code": "DUPLICATE_ORDER_ITEM", "message": "Duplicate products are not allowed in the same order"})

            # Lock inventory rows on databases that support SELECT ... FOR UPDATE so
            # concurrent order creation cannot oversell the same stock as easily.
            products = {
                p.id: p
                for p in db.scalars(select(Product).where(Product.id.in_(ids)).with_for_update()).all()
            }
            missing = [pid for pid in ids if pid not in products]
            if missing:
                raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": f"Products not found: {missing}"})

            order = Order(customer_id=data.customer_id, status=data.status.upper(), total_amount=Decimal("0"))
            db.add(order)
            db.flush()
            total = Decimal("0")
            for item in data.items:
                product = products[item.product_id]
                if data.status != "CANCELLED":
                    if product.stock_quantity < item.quantity:
                        raise HTTPException(status_code=409, detail={"code": "INSUFFICIENT_STOCK", "message": f"Insufficient stock for {product.product_name}"})
                    product.stock_quantity -= item.quantity
                line_total = product.price * item.quantity
                total += line_total
                db.add(OrderItem(order_id=order.id, product_id=product.id, quantity=item.quantity, price=product.price))
            order.total_amount = total
            db.commit()
            db.refresh(order)
            return order
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def add_item(db: Session, order: Order, data: OrderItemCreate) -> Order:
        try:
            if order.status == "CANCELLED":
                raise HTTPException(status_code=409, detail={"code": "ORDER_NOT_EDITABLE", "message": "Cancelled orders cannot be modified"})
            if any(i.product_id == data.product_id for i in order.items):
                raise HTTPException(status_code=409, detail={"code": "DUPLICATE_ORDER_ITEM", "message": "Product already exists in order"})
            product = db.scalar(select(Product).where(Product.id == data.product_id).with_for_update())
            if not product:
                raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found"})
            if product.stock_quantity < data.quantity:
                raise HTTPException(status_code=409, detail={"code": "INSUFFICIENT_STOCK", "message": "Insufficient stock"})
            product.stock_quantity -= data.quantity
            db.add(OrderItem(order_id=order.id, product_id=product.id, quantity=data.quantity, price=product.price))
            order.total_amount += product.price * data.quantity
            db.commit()
            db.refresh(order)
            return order
        except Exception:
            db.rollback()
            raise
