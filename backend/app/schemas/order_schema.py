from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

OrderStatus = Literal["PENDING", "COMPLETED", "CANCELLED"]


class OrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100)


class OrderCreate(BaseModel):
    customer_id: int = Field(gt=0)
    items: list[OrderItemCreate] = Field(min_length=1, max_length=100)
    status: OrderStatus = "COMPLETED"

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "customer_id": 1,
            "items": [{"product_id": 1, "quantity": 1}, {"product_id": 3, "quantity": 1}],
            "status": "COMPLETED"
        }
    })


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    price: Decimal
    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: int
    customer_id: int
    order_date: datetime
    total_amount: Decimal
    status: str
    items: list[OrderItemResponse]
    model_config = ConfigDict(from_attributes=True)
