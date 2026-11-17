from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import models, schemas


async def get_all_products(db: AsyncSession) -> list[models.Product]:
    result = await db.execute(select(models.Product))
    return result.scalars().all()


async def create_product(db: AsyncSession, data: schemas.ProductCreate, seller_id: int) -> models.Product:
    product = models.Product(**data.model_dump(), seller_id=seller_id)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def update_product(db: AsyncSession, product_id: int, data: schemas.ProductUpdate) -> models.Product | None:
    # Обновляем только переданные поля
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return None
        
    await db.execute(
        update(models.Product)
        .where(models.Product.id == product_id)
        .values(**update_data)
    )
    await db.commit()
    
    # Возвращаем обновленный объект
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    return result.scalar_one_or_none()


async def delete_product(db: AsyncSession, product_id: int) -> bool:
    result = await db.execute(
        delete(models.Product).where(models.Product.id == product_id)
    )
    await db.commit()
    return result.rowcount > 0