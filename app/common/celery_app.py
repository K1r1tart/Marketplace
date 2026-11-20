from celery import Celery
from celery.schedules import crontab
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
    # Настройка Beat: запуск задачи динамического ценообразования каждую минуту
    beat_schedule={
        "dynamic-pricing-every-minute": {
            "task": "app.analytics.tasks.dynamic_pricing_task",
            "schedule": 60.0,  # Каждые 60 секунд
        },
    },
)

# Импортируем задачи, чтобы Celery их зарегистрировал
import app.notifications.tasks  # noqa: E402
import app.analytics.tasks  # noqa: E402