import logging
from app.common.celery_app import celery_app
from app.common.database import AsyncSessionLocal
from sqlalchemy import select
from app.orders.models import Order

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def send_receipt_email_task(self, order_id: int):
    """Асинхронная задача отправки чека на email"""
    import asyncio

    async def _send():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Order).where(Order.id == order_id))
            order = result.scalar_one_or_none()

            if not order:
                logger.error(f"Заказ {order_id} не найден для отправки чека")
                return

            # Здесь должна быть реальная интеграция с SMTP (aiosmtplib) или сервисом типа Resend/Mailgun.
            # Для демо мы эмулируем успешную отправку и логируем её.
            email_subject = f"Чек за заказ №{order.id}"
            email_body = f"Спасибо за покупку! Сумма заказа: {order.total_amount} руб. Статус: {order.status}"

            logger.info(
                f"📧 [MOCK EMAIL] Отправка чека: Тема='{email_subject}', Текст='{email_body}'"
            )

            # Если бы были реальные настройки SMTP:
            # await send_real_email(order.user_email, email_subject, email_body)

            return {"status": "success", "order_id": order.id}

    # Запускаем асинхронную функцию внутри синхронной Celery-задачи
    return asyncio.run(_send())
