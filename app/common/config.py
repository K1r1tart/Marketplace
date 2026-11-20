from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Безопасность
    SECRET_KEY: str = "dev-secret-change-me-in-prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # БД
    DATABASE_URL: str = (
        "postgresql+asyncpg://marketplace:marketplace_pass@postgres:5432/marketplace"
    )
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "amqp://mq_user:mq_pass@rabbitmq:5672//"

    # Email (рассылка чеков)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
