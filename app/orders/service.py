import asyncio
from app.auth.models import User
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
        delivery_cost=delivery_cost,
        status=models.OrderStatus.PENDING.value,
        items=order_items,
    )

    db.add(order)
    await db.commit()
    await db.refresh(order)

    result = await db.execute(
        select(models.Order)
        .options(selectinload(models.Order.items))
        .where(models.Order.id == order.id)
    )
    fresh_order = result.scalar_one()

    # 4. Получаем email покупателя из БД
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    recipient_email = user.email if user else os.getenv("SMTP_FROM", "noreply@marketplace.local")

    # 5. Отправляем задачу в Celery (асинхронно!)
    try:
        send_receipt_email_task.delay(fresh_order.id, recipient_email)
    except Exception as e:
        print(f"⚠️ Celery недоступен, задача не отправлена: {e}")

    return fresh_order


async def pay_order(db: AsyncSession, order_id: int, user_id: int) -> models.Order:
    """Эмуляция оплаты заказа через внешний платежный шлюз"""
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

    # Эмуляция задержки банка
    await asyncio.sleep(1.5)

    order.status = models.OrderStatus.PAID.value
    await db.commit()
    await db.refresh(order)

    # Получаем email покупателя
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    recipient_email = user.email if user else os.getenv("SMTP_FROM", "noreply@marketplace.local")

    try:
        send_receipt_email_task.delay(order.id, recipient_email)
    except Exception as e:
        print(f"⚠️ Не удалось отправить чек после оплаты: {e}")

    return order