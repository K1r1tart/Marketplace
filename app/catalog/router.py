from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.database import get_db
from app.auth.dependencies import require_role
from app.auth import models as user_models
from app.catalog import models, schemas, service

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=list[schemas.ProductOut])
async def list_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search by title/description"),
):
    return await service.get_products(db, category=category, search=search)


@router.get("/recommendations", response_model=list[schemas.ProductOut])
async def get_recommendations(
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str = Query(..., description="Category for recommendations"),
    exclude_id: Optional[int] = Query(None, description="Exclude product id"),
):
    return await service.get_recommendations(db, category=category, exclude_id=exclude_id)


@router.post("/", response_model=schemas.ProductOut, status_code=201)
async def create_product(
    data: schemas.ProductCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["seller", "admin"]))],
):
    return await service.create_product(db, data, current_user.id)


@router.put("/{product_id}", response_model=schemas.ProductOut)
async def update_product(
    product_id: int,
    data: schemas.ProductUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["seller", "admin"]))],
):
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No permission to edit this product")

    updated = await service.update_product(db, product_id, data)
    return updated


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["seller", "admin"]))],
):
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No permission to delete this product")

    await service.delete_product(db, product_id)

@router.post("/{product_id}/view", status_code=204)
async def register_view(
    product_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Регистрирует просмотр товара (для ML и динамического ценообразования)"""
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    product = result.scalar_one_or_none()
    if product:
        product.views += 1
        await db.commit()