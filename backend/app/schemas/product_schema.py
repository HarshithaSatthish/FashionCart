from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

ClothingCategory = Literal[
    "T-Shirts", "Shirts", "Jeans", "Trousers", "Dresses", "Jackets",
    "Shoes", "Handbags", "Accessories", "Sportswear"
]


class ProductBase(BaseModel):
    product_name: str = Field(min_length=2, max_length=120)
    category: ClothingCategory
    subcategory: str | None = Field(default=None, max_length=80)
    brand: str | None = Field(default=None, max_length=80)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    stock_quantity: int = Field(ge=0)

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "product_name": "Classic T-Shirt",
            "category": "T-Shirts",
            "subcategory": "Crew Neck",
            "brand": "UrbanWeave",
            "price": "999.00",
            "stock_quantity": 100
        }
    })


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    product_name: str | None = Field(default=None, min_length=2, max_length=120)
    category: ClothingCategory | None = None
    subcategory: str | None = Field(default=None, max_length=80)
    brand: str | None = Field(default=None, max_length=80)
    price: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    stock_quantity: int | None = Field(default=None, ge=0)


class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
