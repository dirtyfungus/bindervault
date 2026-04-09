import redis.asyncio as aioredis
from app.core.config import settings

_redis = None


async def init_redis():
    global _redis
    _redis = await aioredis.from_url(settings.redis_url, decode_responses=True)


async def close_redis():
    global _redis
    if _redis:
        await _redis.close()


def get_redis():
    return _redis
