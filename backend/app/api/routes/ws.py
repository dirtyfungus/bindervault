import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from app.core.config import settings
from app.core.redis import get_redis

router = APIRouter()


@router.websocket("/notifications")
async def ws_notifications(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    redis = get_redis()
    if not redis:
        await websocket.close(code=4002)
        return

    pubsub = redis.pubsub()
    await pubsub.subscribe(f"user:{user_id}:notifications")

    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("type") == "message":
                await websocket.send_text(message["data"])
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"user:{user_id}:notifications")
        await pubsub.close()
