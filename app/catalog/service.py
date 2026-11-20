from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import models, schemas


async def get_products(
    db: AsyncSession,
    category: str | None = None,
    search: str | None = None,
    limit: int = 50,
) -> list[models.Product]:
    """Получить товары с фильтрацией по категории и поиском"""
    query = select(models.Product)
    
    if category and category != "all":
        query = query.where(models.Product.category == category)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (models.Product.title.ilike(search_term)) |
            (models.Product.description.ilike(search_term))
        )
    
    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_recommendations(
    db: AsyncSession,
    category: str,
    exclude_id: int | None = None,
    limit: int = 4,
) -> list[models.Product]:
    """Получить рекомендации - товары из той же категории"""
    query = select(models.Product).where(models.Product.category == category)
    if exclude_id:
        query = query.where(models.Product.id != exclude_id)
    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def create_product(db: AsyncSession, data: schemas.ProductCreate, seller_id: int) -> models.Product:
    product = models.Product(**data.model_dump(), seller_id=seller_id)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def update_product(db: AsyncSession, product_id: int, data: schemas.ProductUpdate) -> models.Product | None:
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return None
        
    await db.execute(
        update(models.Product)
        .where(models.Product.id == product_id)
        .values(**update_data)
    )
    await db.commit()
    
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    return result.scalar_one_or_none()


async def delete_product(db: AsyncSession, product_id: int) -> bool:
    result = await db.execute(
        delete(models.Product).where(models.Product.id == product_id)
    )
    await db.commit()
    return result.rowcount > 0