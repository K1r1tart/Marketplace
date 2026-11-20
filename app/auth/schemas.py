from typing import Literal
from pydantic import BaseModel, EmailStr


Role = Literal["buyer", "seller", "admin"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: Role = "buyer"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: Role

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
