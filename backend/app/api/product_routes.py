from sqlalchemy import select, func
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.repositories.product_repository import ProductRepository
from app.schemas.product_schema import ProductCreate, ProductUpdate, ProductResponse
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["Products"])

@router.post("", response_model=ProductResponse, status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN"))):
    return ProductService.create(db, data)

@router.get("")
def list_products(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), search: str | None = None,
                  category: str | None = None, min_price: float | None = Query(None, ge=0), max_price: float | None = Query(None, ge=0),
                  sort_by: str = "id", sort_order: str = "asc", db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items, total = ProductRepository.list(db, page=page, limit=limit, search=search, category=category, min_price=min_price,
                                          max_price=max_price, sort_by=sort_by, sort_order=sort_order)
    return {"items": [ProductResponse.model_validate(x) for x in items], "page": page, "limit": limit, "total": total}

@router.get("/stats", summary="Catalog summary counts (total, categories, low/out of stock)")
def product_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from app.models.product import Product
    total = db.scalar(select(func.count(Product.id))) or 0
    categories = db.scalar(select(func.count(func.distinct(Product.category)))) or 0
    low = db.scalar(select(func.count(Product.id)).where(Product.stock_quantity > 0, Product.stock_quantity < 20)) or 0
    out = db.scalar(select(func.count(Product.id)).where(Product.stock_quantity == 0)) or 0
    return {"total": total, "categories": categories, "low_stock": low, "out_of_stock": out}


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return ProductService.get_or_404(db, product_id)

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN"))):
    return ProductService.update(db, product_id, data)

@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN"))):
    ProductService.delete(db, product_id)
    return Response(status_code=204)
