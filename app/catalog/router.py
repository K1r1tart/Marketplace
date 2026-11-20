from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.database import get_db
from app.auth.dependencies import require_role
from app.auth import models as user_models
from app.catalog import models, schemas, service

router = APIRouter(prefix="/products", tags=["products"])


# 1. Получить все товары (доступно всем)
@router.get("/", response_model=list[schemas.ProductOut])
async def list_products(db: Annotated[AsyncSession, Depends(get_db)]):
    return await service.get_all_products(db)


# 2. Создать товар (только seller и admin)
@router.post("/", response_model=schemas.ProductOut, status_code=201)
async def create_product(
    data: schemas.ProductCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[
        user_models.User, Depends(require_role(["seller", "admin"]))
    ],
):
    return await service.create_product(db, data, current_user.id)


# 3. Обновить товар (только владелец или admin)
@router.put("/{product_id}", response_model=schemas.ProductOut)
async def update_product(
    product_id: int,
    data: schemas.ProductUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[
        user_models.User, Depends(require_role(["seller", "admin"]))
    ],
):
    # Сначала проверяем, существует ли товар и кто его владелец
    from sqlalchemy import select

    result = await db.execute(
        select(models.Product).where(models.Product.id == product_id)
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    # Проверка прав: редактировать может только владелец или админ
    if product.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Нет прав на редактирование чужого товара"
        )

    updated = await service.update_product(db, product_id, data)
    return updated


# 4. Удалить товар (только владелец или admin)
@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[
        user_models.User, Depends(require_role(["seller", "admin"]))
    ],
):
    from sqlalchemy import select

    result = await db.execute(
        select(models.Product).where(models.Product.id == product_id)
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    if product.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Нет прав на удаление чужого товара"
        )

    await service.delete_product(db, product_id)
