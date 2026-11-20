import logging
import asyncio
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.common.celery_app import celery_app

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://marketplace:marketplace_pass@postgres:5432/marketplace"
)


@celery_app.task(bind=True, max_retries=3)
def send_receipt_email_task(self, order_id: int):
    """Асинхронная задача отправки чека на email"""

    async def _send():
        # Создаём свой движок с NullPool, чтобы избежать конфликта event loop
        engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        try:
            async with SessionLocal() as db:
                from app.orders.models import Order
                result = await db.execute(select(Order).where(Order.id == order_id))
                order = result.scalar_one_or_none()

                if not order:
                    logger.error(f"Заказ {order_id} не найден для отправки чека")
                    return {"status": "error", "reason": "order_not_found"}

                # Эмулируем отправку email
                email_subject = f"Чек за заказ №{order.id}"
                email_body = (
                    f"Спасибо за покупку! Сумма заказа: {order.total_amount} руб. "
                    f"Доставка: {order.delivery_cost} руб. "
                    f"Итого к оплате: {order.total_amount + order.delivery_cost} руб. "
                    f"Статус: {order.status}"
                )
                logger.info(f"📧 [MOCK EMAIL] Отправка чека: Тема='{email_subject}', Текст='{email_body}'")

                return {"status": "success", "order_id": order.id}

        except Exception as e:
            logger.error(f"❌ Ошибка в send_receipt_email_task: {e}")
            raise
        finally:
            await engine.dispose()

    return asyncio.run(_send())