from celery import Celery
from app.common.config import settings

celery_app = Celery(
    "marketplace",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Позже здесь будут задачи: send_email_receipt, update_dynamic_prices и т.д.