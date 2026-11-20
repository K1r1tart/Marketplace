import logging
import asyncio
import os
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from app.common.celery_app import celery_app
from app.catalog.models import Product

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://marketplace:marketplace_pass@postgres:5432/marketplace"
)


@celery_app.task(bind=True, max_retries=3)
def dynamic_pricing_task(self):
    """
    Фоновая задача динамического ценообразования (Celery Beat, раз в 60 сек).
    Использует СВОЙ движок с NullPool, чтобы избежать конфликта event loop
    между импортом модуля и asyncio.run() внутри Celery.
    """
    async def _run():
        # NullPool = соединения НЕ кэшируются, каждое создаётся в текущем loop
        engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        try:
            async with SessionLocal() as db:
                result = await db.execute(select(Product))
                products = result.scalars().all()

                updated = 0
                for product in products:
                    old_price = product.price

                    if product.views > 10:
                        new_price = round(product.price * 1.05, 2)
                        logger.info(f"📈 '{product.title}': {old_price} → {new_price} (views={product.views})")
                    elif product.views == 0 and old_price > 10:
                        new_price = round(product.price * 0.98, 2)
                        logger.info(f"📉 '{product.title}': {old_price} → {new_price} (views=0)")
                    else:
                        continue

                    await db.execute(
                        update(Product)
                        .where(Product.id == product.id)
                        .values(price=new_price, views=0)
                    )
                    updated += 1

                await db.commit()
                logger.info(f"✅ Динамическое ценообразование: обновлено {updated} товаров")
                return {"updated": updated}

        except Exception as e:
            logger.error(f"❌ Ошибка dynamic_pricing_task: {e}")
            raise
        finally:
            await engine.dispose()  # гарантированно закрываем соединения

    return asyncio.run(_run())