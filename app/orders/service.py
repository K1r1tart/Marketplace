import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.orders import models, schemas
from app.catalog.models import Product
from app.notifications.tasks import send_receipt_email_task
from app.delivery.service import delivery_service
from app.payments.yookassa_service import create_payment  # ← НОВЫЙ ИМПОРТ


async def create_order(
    db: AsyncSession, user_id: int, data: schemas.OrderCreate
) -> models.Order:
    total_amount = 0.0
    order_items = []

    for item_data in data.items:
        result = await db.execute(
            select(Product).where(Product.id == item_data.product_id)
        )
        product = result.scalar_one_or_none()

        if not product:
            raise HTTPException(status_code=404, detail=f"Товар с ID {item_data.product_id} не найден")
        if product.stock < item_data.quantity:
            raise HTTPException(status_code=400, detail=f"Недостаточно товара '{product.title}' на складе")

        product.stock -= item_data.quantity
        total_amount += product.price * item_data.quantity

        order_items.append(
            models.OrderItem(
                product_id=product.id,
                quantity=item_data.quantity,
                price_at_purchase=product.price,
            )
        )

    delivery_info = await delivery_service.calculate_delivery(total_amount)
    delivery_cost = delivery_info["cost"]

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

    from app.auth.models import User
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    recipient_email = user.email if user else "noreply@marketplace.local"

    try:
        send_receipt_email_task.delay(fresh_order.id, recipient_email)
    except Exception as e:
        print(f"⚠️ Celery недоступен: {e}")

    return fresh_order


async def pay_order(db: AsyncSession, order_id: int, user_id: int) -> dict:
    """Создать платёж через ЮKassa"""
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

    total_amount = order.total_amount + order.delivery_cost

    try:
        payment_data = create_payment(
            order_id=order_id,
            amount=total_amount,
            description=f"Оплата заказа №{order_id}"
        )

        order.payment_id = payment_data["payment_id"]
        await db.commit()

        return payment_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка создания платежа: {str(e)}")