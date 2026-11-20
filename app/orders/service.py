import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.orders import models, schemas
from app.catalog.models import Product
from app.notifications.tasks import send_receipt_email_task
from app.delivery.service import delivery_service  # ← НОВЫЙ ИМПОРТ


async def create_order(
    db: AsyncSession, user_id: int, data: schemas.OrderCreate
) -> models.Order:
    total_amount = 0.0
    order_items = []

    # 1. Проверяем товары и считаем сумму
    for item_data in data.items:
        result = await db.execute(
            select(Product).where(Product.id == item_data.product_id)
        )
        product = result.scalar_one_or_none()

        if not product:
            raise HTTPException(
                status_code=404, detail=f"Товар с ID {item_data.product_id} не найден"
            )
        if product.stock < item_data.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Недостаточно товара '{product.title}' на складе",
            )

        # Списываем со склада
        product.stock -= item_data.quantity
        total_amount += product.price * item_data.quantity

        order_items.append(
            models.OrderItem(
                product_id=product.id,
                quantity=item_data.quantity,
                price_at_purchase=product.price,
            )
        )

    # 2. Рассчитываем стоимость доставки (эмуляция внешнего API)
    delivery_info = await delivery_service.calculate_delivery(total_amount)
    delivery_cost = delivery_info["cost"]

    # 3. Создаем заказ
    order = models.Order(
        user_id=user_id,
        total_amount=total_amount,
        delivery_cost=delivery_cost,  # ← НОВОЕ ПОЛЕ
        status=models.OrderStatus.PENDING.value,
        items=order_items,
    )

    db.add(order)
    await db.commit()

    # ⚠️ КРИТИЧЕСКИ ВАЖНО: Обновляем объект, чтобы получить order.id и избежать MissingGreenlet
    await db.refresh(order)

    # 4. Перечитываем заказ из БД с явной подгрузкой items (eager loading)
    result = await db.execute(
        select(models.Order)
        .options(selectinload(models.Order.items))
        .where(models.Order.id == order.id)
    )
    fresh_order = result.scalar_one()

    # 5. Отправляем задачу в Celery (асинхронная обработка!)
    try:
        send_receipt_email_task.delay(fresh_order.id)
    except Exception as e:
        print(f"⚠️ Celery недоступен, задача не отправлена: {e}")

    return fresh_order


async def pay_order(db: AsyncSession, order_id: int, user_id: int) -> models.Order:
    """Эмуляция оплаты заказа через внешний платежный шлюз"""
    # 1. Находим заказ
    result = await db.execute(
        select(models.Order)
        .options(selectinload(models.Order.items))
        .where(models.Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if order.user_id != user_id:
        raise HTTPException(status_code=403, detail="Нет прав на оплату этого заказа")

    if order.status == models.OrderStatus.PAID.value:
        raise HTTPException(status_code=400, detail="Заказ уже оплачен")

    # 2. Эмулируем задержку сетевого запроса к банку (1.5 секунды)
    await asyncio.sleep(1.5)

    # 3. Меняем статус на оплаченный
    order.status = models.OrderStatus.PAID.value
    await db.commit()
    await db.refresh(order)

    # 4. Отправляем финальный чек на email (асинхронно через Celery)
    try:
        send_receipt_email_task.delay(order.id)
    except Exception as e:
        print(f"⚠️ Не удалось отправить чек после оплаты: {e}")

    return order