import asyncio
import logging
import random

logger = logging.getLogger(__name__)


class DeliveryService:
    """Эмуляция внешнего сервиса доставки (СДЭК, Почта России и т.д.)"""

    @staticmethod
    async def calculate_delivery(order_total: float) -> dict:
        """
        Эмулирует запрос к внешнему API доставки.
        Возвращает стоимость и срок доставки.
        """
        # Эмулируем сетевую задержку (0.5-1.5 секунды)
        await asyncio.sleep(random.uniform(0.5, 1.5))

        # Логика расчёта:
        # - Бесплатная доставка от 5000 ₽
        # - Иначе: 5% от суммы заказа, но не менее 200 ₽ и не более 1000 ₽
        if order_total >= 5000:
            cost = 0.0
            days = 3
            method = "Бесплатная доставка (от 5000 ₽)"
        else:
            cost = max(200, min(order_total * 0.05, 1000))
            days = random.choice([3, 5, 7])
            method = "Стандартная доставка"

        logger.info(
            f"🚚 [MOCK DELIVERY] Расчёт доставки: сумма={order_total} ₽, "
            f"стоимость={cost} ₽, срок={days} дн., метод={method}"
        )

        return {
            "cost": round(cost, 2),
            "estimated_days": days,
            "method": method,
        }


# Синглтон для удобства импорта
delivery_service = DeliveryService()