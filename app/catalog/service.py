from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import models, schemas
from app.common.cache import get_cached, set_cached, invalidate_pattern


async def get_products(
    db: AsyncSession,
    category: str | None = None,
    search: str | None = None,
    limit: int = 50,
) -> list[models.Product]:
    """Получить товары с фильтрацией. Результат кэшируется в Redis."""
    cache_key = f"products:{category or 'all'}:{search or ''}:{limit}"

    # 1. Пробуем кэш
    cached = await get_cached(cache_key)
    if cached is not None:
        # Десериализуем обратно в объекты для совместимости с роутером
        return [models.Product(**item) for item in cached]

    # 2. Промах — идём в БД
    query = select(models.Product)
    if category and category != "all":
        query = query.where(models.Product.category == category)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (models.Product.title.ilike(search_term))
            | (models.Product.description.ilike(search_term))
        )
    query = query.limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()

    # 3. Пишем в кэш (сериализуем через Pydantic)
    serializable = [schemas.ProductOut.model_validate(p).model_dump() for p in products]
    await set_cached(cache_key, serializable)

    return products


async def get_recommendations(
    db: AsyncSession,
    category: str,
    exclude_id: int | None = None,
    limit: int = 4,
) -> list[models.Product]:
    """Рекомендации из той же категории (тоже кэшируются)."""
    cache_key = f"recs:{category}:{exclude_id or 0}:{limit}"

    cached = await get_cached(cache_key)
    if cached is not None:
        return [models.Product(**item) for item in cached]

    query = select(models.Product).where(models.Product.category == category)
    if exclude_id:
        query = query.where(models.Product.id != exclude_id)
    query = query.limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()

    serializable = [schemas.ProductOut.model_validate(p).model_dump() for p in products]
    await set_cached(cache_key, serializable)

    return products


async def create_product(db: AsyncSession, data: schemas.ProductCreate, seller_id: int) -> models.Product:
    product = models.Product(**data.model_dump(), seller_id=seller_id)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await invalidate_pattern("products:*")
    await invalidate_pattern("recs:*")
    return product


async def update_product(db: AsyncSession, product_id: int, data: schemas.ProductUpdate) -> models.Product | None:
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return None

    await db.execute(
        update(models.Product).where(models.Product.id == product_id).values(**update_data)
    )
    await db.commit()

    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    await invalidate_pattern("products:*")
    await invalidate_pattern("recs:*")
    return result.scalar_one_or_none()


async def delete_product(db: AsyncSession, product_id: int) -> bool:
    result = await db.execute(delete(models.Product).where(models.Product.id == product_id))
    await db.commit()
    await invalidate_pattern("products:*")
    await invalidate_pattern("recs:*")
    return result.rowcount > 0