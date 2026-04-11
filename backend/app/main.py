from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.redis import init_redis, close_redis
from app.api.routes import auth, users, binder, trades, scryfall, notifications, schedules, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    yield
    await close_redis()


app = FastAPI(
    title="BinderVault API",
    description="MTG trade binder platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(binder.router, prefix="/api/binder", tags=["binder"])
app.include_router(trades.router, prefix="/api/trades", tags=["trades"])
app.include_router(chat.router, prefix="/api/trades", tags=["chat"])
app.include_router(scryfall.router, prefix="/api/scryfall", tags=["scryfall"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["schedules"])

from app.api.routes.ws import router as ws_router
app.include_router(ws_router, prefix="/ws", tags=["websocket"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}