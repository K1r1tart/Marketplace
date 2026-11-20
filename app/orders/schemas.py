from typing import List, Optional
from pydantic import BaseModel, Field
from app.orders.models import OrderStatus

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., ge=1)

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    # В реальном проекте здесь были бы адрес доставки и т.д.

class OrderItemOut(BaseModel):
    product_id: int
    quantity: int
    price_at_purchase: float

    class Config:
        from_attributes = True

class OrderOut(BaseModel):
    id: int
    user_id: int
    total_amount: float
    status: str
    items: List[OrderItemOut]

    class Config:
        from_attributes = True