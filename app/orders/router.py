from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.database import get_db
from app.auth.dependencies import get_current_user, require_role
from app.auth import models as user_models
from app.orders import models, schemas, service

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/", response_model=schemas.OrderOut, status_code=201)
async def create_new_order(
    data: schemas.OrderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["buyer", "admin"]))],
):
    """Оформление заказа (доступно покупателям и админам)"""
    return await service.create_order(db, current_user.id, data)


@router.get("/my", response_model=list[schemas.OrderOut])
async def get_my_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(get_current_user)],
):
    """Получить свои заказы (тоже с явной подгрузкой items)"""
    result = await db.execute(
        select(models.Order)
        .options(selectinload(models.Order.items))
        .where(models.Order.user_id == current_user.id)
    )
    return result.scalars().all()