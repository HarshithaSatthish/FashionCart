from collections import defaultdict
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.imported_transaction import ImportedTransactionItem


class TransactionRepository:
    @staticmethod
    def from_completed_orders(db: Session) -> list[list[str]]:
        rows = db.execute(
            select(Order.id, Product.product_name)
            .join(OrderItem, OrderItem.order_id == Order.id)
            .join(Product, Product.id == OrderItem.product_id)
            .where(Order.status == "COMPLETED")
            .order_by(Order.id)
        ).all()
        grouped: dict[int, list[str]] = defaultdict(list)
        for order_id, product_name in rows:
            grouped[order_id].append(product_name)
        return [items for items in grouped.values() if items]

    @staticmethod
    def from_imports(db: Session) -> list[list[str]]:
        rows = db.execute(select(ImportedTransactionItem.transaction_id, ImportedTransactionItem.product).order_by(ImportedTransactionItem.transaction_id)).all()
        grouped: dict[str, list[str]] = defaultdict(list)
        for txid, product in rows:
            grouped[txid].append(product)
        return [items for items in grouped.values() if items]
