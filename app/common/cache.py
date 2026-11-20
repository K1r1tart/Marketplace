import json
import os
import redis.asyncio as redis

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Асинхронный клиент Redis (decode_responses=True возвращает строки, а не bytes)
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

CACHE_TTL = 30  # Время жизни кэша в секундах (коротко, чтобы динамические цены не устаревали)


async def get_cached(key: str):
    """Получить данные из кэша. Возвращает None при промахе."""
    try:
        data = await redis_client.get(key)
        return json.loads(data) if data else None
    except Exception:
        # Graceful degradation: если Redis недоступен, молча возвращаем None (пойдём в БД)
        return None


async def set_cached(key: str, value, ttl: int = CACHE_TTL):
    """Сохранить данные в кэш."""
    try:
        await redis_client.set(key, json.dumps(value), ex=ttl)
    except Exception:
        pass


async def invalidate_pattern(pattern: str):
    """Удалить все ключи, подходящие под паттерн (например, 'products:*')."""
    try:
        keys = []
        async for key in redis_client.scan_iter(match=pattern, count=100):
            keys.append(key)
        if keys:
            await redis_client.delete(*keys)
    except Exception:
        pass