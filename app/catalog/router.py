from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile, File
import os
import uuid

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


@router.get("/recommendations")
async def get_recommendations(
    product_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],  # <-- 1. Сначала ОБЯЗАТЕЛЬНЫЙ аргумент (без '=')
    limit: int = 4,                                # <-- 2. В самом конце аргумент СО ЗНАЧЕНИЕМ ПО УМОЛЧАНИЮ
):
    """
    Рекомендательная система: 
    Возвращает популярные товары из той же категории, исключая текущий и отсутствующие на складе.
    """
    from sqlalchemy import desc
    
    # 1. Узнаем категорию текущего товара
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    current_product = result.scalar_one_or_none()
    
    if not current_product:
        return []

    # 2. Ищем похожие товары
    query = (
        select(models.Product)
        .where(
            models.Product.category == current_product.category,
            models.Product.id != product_id,
            models.Product.stock > 0  # Показываем только то, что можно купить
        )
        .order_by(desc(models.Product.views))  # Сортируем по популярности (просмотрам)
        .limit(limit)
    )
    
    result = await db.execute(query)
    recommendations = result.scalars().all()
    
    # Преобразуем в словари для JSON-ответа
    return [
        {
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "price": p.price,
            "category": p.category,
            "views": p.views,
            "image_url": p.image_url,
            "stock": p.stock
        }
        for p in recommendations
    ]


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
    data: schemas.ProductCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["seller", "admin"]))],
):
    """Редактировать товар (только владелец или админ)"""
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    if product.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Нет прав на редактирование этого товара")

    product.title = data.title
    product.description = data.description
    product.price = data.price
    product.stock = data.stock
    product.category = data.category

    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["seller", "admin"]))],
):
    """Удалить товар (полное удаление, если он не в заказах)"""
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    if product.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Нет прав на удаление этого товара")

    # === ПРОВЕРКА ЦЕЛОСТНОСТИ: участвует ли товар в заказах? ===
    from app.orders.models import OrderItem
    check = await db.execute(
        select(OrderItem.id).where(OrderItem.product_id == product_id).limit(1)
    )
    
    if check.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=400,
            detail="Товар уже участвует в заказах. Его нельзя удалить полностью. Чтобы снять его с продажи, измените остаток (stock) на 0 в настройках товара."
        )

    # Если товар ни разу не покупали — удаляем его полностью
    await db.delete(product)
    await db.commit()

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

# Убедитесь, что папка существует
UPLOAD_DIR = "app/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/{product_id}/upload-image", response_model=schemas.ProductOut)
async def upload_product_image(
    product_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(require_role(["seller", "admin"]))],
    file: UploadFile = File(...),  # ← ВАЖНО: параметр с '=' должен быть ПОСЛЕДНИМ!
):
    """Загрузка изображения для товара"""
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    if product.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Нет прав на изменение этого товара")

    # Генерируем уникальное имя файла
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Сохраняем файл
    with open(filepath, "wb") as buffer:
        buffer.write(await file.read())

    # Обновляем URL в БД
    product.image_url = f"/static/uploads/{filename}"
    await db.commit()
    await db.refresh(product)
    
    return product

