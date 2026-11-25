import logging
import asyncio
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy.pool import NullPool
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib

from app.common.celery_app import celery_app

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://marketplace:marketplace_pass@postgres:5432/marketplace"
)


@celery_app.task(bind=True, max_retries=3)
def send_receipt_email_task(self, order_id: int, recipient_email: str):
    """Отправка HTML-чека на email покупателя через Gmail SMTP"""

    async def _send():
        engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        try:
            async with SessionLocal() as db:
                from app.orders.models import Order
                result = await db.execute(
                    select(Order)
                    .options(selectinload(Order.items))
                    .where(Order.id == order_id)
                )
                order = result.scalar_one_or_none()

                if not order:
                    logger.error(f"Заказ {order_id} не найден для отправки чека")
                    return {"status": "error", "reason": "order_not_found"}

                # === Получаем НАЗВАНИЯ товаров из таблицы products ===
                from app.catalog.models import Product
                product_ids = [item.product_id for item in order.items]
                titles = {}
                if product_ids:
                    products_result = await db.execute(
                        select(Product.id, Product.title).where(
                            Product.id.in_(product_ids)
                        )
                    )
                    titles = {pid: title for pid, title in products_result.all()}

                # Формируем строки таблицы товаров (название вместо ID)
                items_html = "".join(
                    f"<tr>"
                    f"<td style='padding:8px;border-bottom:1px solid #eee;'>{titles.get(item.product_id, f'Товар #{item.product_id}')}</td>"
                    f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:center;'>{item.quantity}</td>"
                    f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right;'>{item.price_at_purchase:.2f} ₽</td>"
                    f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right;'>{item.quantity * item.price_at_purchase:.2f} ₽</td>"
                    f"</tr>"
                    for item in order.items
                )

                final_total = order.total_amount + order.delivery_cost

                # Человекочитаемый статус
                status_readable = "Оплачен" if order.status == "paid" else "Ожидает оплаты"

                # HTML-шаблон письма
                html_body = f"""
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%);color:white;padding:24px;text-align:center;">
                        <h2 style="margin:0;">🛒 Marketplace</h2>
                        <p style="margin:8px 0 0;">Чек за заказ №{order.id}</p>
                    </div>
                    <div style="padding:24px;">
                        <p>Спасибо за покупку! Ниже детали вашего заказа:</p>
                        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                            <thead>
                                <tr style="background:#f3f4f6;">
                                    <th style="padding:8px;text-align:left;">Товар</th>
                                    <th style="padding:8px;text-align:center;">Кол-во</th>
                                    <th style="padding:8px;text-align:right;">Цена</th>
                                    <th style="padding:8px;text-align:right;">Сумма</th>
                                </tr>
                            </thead>
                            <tbody>{items_html}</tbody>
                        </table>
                        <div style="border-top:2px solid #7c3aed;padding-top:12px;">
                            <p style="margin:4px 0;">Товары: <b>{order.total_amount:.2f} ₽</b></p>
                            <p style="margin:4px 0;">Доставка: <b>{order.delivery_cost:.2f} ₽</b></p>
                            <p style="margin:4px 0;font-size:18px;">Итого к оплате: <b style="color:#7c3aed;">{final_total:.2f} ₽</b></p>
                            <p style="margin:4px 0;">Статус: <b>{status_readable}</b></p>
                        </div>
                    </div>
                    <div style="background:#f9fafb;padding:16px;text-align:center;color:#6b7280;font-size:12px;">
                        С уважением, команда Marketplace
                    </div>
                </div>
                """

                smtp_host = os.getenv("SMTP_HOST")
                if smtp_host:
                    try:
                        msg = MIMEMultipart("alternative")
                        msg["From"] = os.getenv("SMTP_FROM", "noreply@marketplace.local")
                        msg["To"] = recipient_email
                        msg["Subject"] = f"Чек за заказ №{order.id}"
                        msg.attach(MIMEText(html_body, "html", "utf-8"))

                        await aiosmtplib.send(
                            msg,
                            hostname=smtp_host,
                            port=int(os.getenv("SMTP_PORT", 587)),
                            username=os.getenv("SMTP_USER"),
                            password=os.getenv("SMTP_PASSWORD"),
                            use_tls=False,
                            start_tls=True,
                        )
                        logger.info(f"✅ Email отправлен на {recipient_email}: Чек за заказ №{order.id}")
                    except Exception as e:
                        logger.error(f"❌ Ошибка отправки email: {e}")
                        logger.info(f"📧 [MOCK EMAIL] (fallback) на {recipient_email}: Чек за заказ №{order.id}")
                else:
                    logger.info(f"📧 [MOCK EMAIL] на {recipient_email}: Чек за заказ №{order.id}")

                return {"status": "success", "order_id": order.id, "to": recipient_email}

        except Exception as e:
            logger.error(f"❌ Ошибка в send_receipt_email_task: {e}")
            raise
        finally:
            await engine.dispose()

    return asyncio.run(_send())