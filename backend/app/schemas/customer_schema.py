from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    gender: str | None = None
    age: int | None = Field(default=None, ge=1, le=120)


class CustomerResponse(CustomerCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
