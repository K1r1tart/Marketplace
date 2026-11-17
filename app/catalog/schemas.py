from typing import Optional
from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    price: float = Field(..., gt=0)  # Цена должна быть > 0
    stock: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    stock: Optional[int] = Field(None, ge=0)


class ProductOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    price: float
    stock: int
    seller_id: int

    class Config:
        from_attributes = True