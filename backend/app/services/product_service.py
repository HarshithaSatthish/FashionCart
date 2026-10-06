from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.product import Product
from app.models.order import OrderItem
from app.repositories.product_repository import ProductRepository
from app.schemas.product_schema import ProductCreate, ProductUpdate


class ProductService:
    @staticmethod
    def get_or_404(db: Session, product_id: int) -> Product:
        product = ProductRepository.get(db, product_id)
        if not product:
            raise HTTPException(status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": f"Product with ID {product_id} was not found"})
        return product

    @staticmethod
    def create(db: Session, data: ProductCreate) -> Product:
        product = Product(**data.model_dump())
        db.add(product); db.commit(); db.refresh(product)
        return product

    @staticmethod
    def update(db: Session, product_id: int, data: ProductUpdate) -> Product:
        product = ProductService.get_or_404(db, product_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(product, key, value)
        db.commit(); db.refresh(product)
        return product

    @staticmethod
    def delete(db: Session, product_id: int) -> None:
        product = ProductService.get_or_404(db, product_id)
        # Historical order items intentionally keep their product reference.
        # Returning a business-level conflict is safer than leaking a DB integrity error.
        if db.query(OrderItem.id).filter(OrderItem.product_id == product_id).first():
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "PRODUCT_IN_USE",
                    "message": "Product is referenced by historical orders and cannot be deleted",
                },
            )
        db.delete(product)
        db.commit()
