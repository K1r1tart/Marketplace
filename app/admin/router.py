from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.database import get_db
from app.auth.dependencies import require_role
from app.auth import models as user_models
from app.orders import models as order_models
from app.catalog import models as catalog_models

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_platform_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["admin"]))],
):
    users_count = await db.execute(select(func.count(user_models.User.id)))
    products_count = await db.execute(select(func.count(catalog_models.Product.id)))
    orders_count = await db.execute(select(func.count(order_models.Order.id)))

    revenue_result = await db.execute(
        select(func.sum(order_models.Order.total_amount + order_models.Order.delivery_cost))
        .where(order_models.Order.status == "paid")
    )
    total_revenue = revenue_result.scalar() or 0.0

    return {
        "total_users": users_count.scalar(),
        "total_products": products_count.scalar(),
        "total_orders": orders_count.scalar(),
        "total_revenue": round(total_revenue, 2),
    }


@router.get("/users")
async def get_all_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["admin"]))],
):
    result = await db.execute(select(user_models.User))
    users = result.scalars().all()
    return [{"id": u.id, "email": u.email, "role": u.role} for u in users]


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["admin"]))],
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")

    await db.execute(delete(user_models.User).where(user_models.User.id == user_id))
    await db.commit()