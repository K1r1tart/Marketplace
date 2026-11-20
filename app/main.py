from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import time

from app.common.database import engine, Base
# Регистрируем все модели, чтобы SQLAlchemy создала таблицы
from app.auth import models as auth_models  # noqa: F401
from app.catalog import models as catalog_models  # noqa: F401
from app.orders import models as order_models  # noqa: F401

from app.auth.router import router as auth_router
from app.catalog.router import router as catalog_router
from app.orders.router import router as orders_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()

app = FastAPI(
    title="Marketplace API",
    description="Модульный маркетплейс с RBAC, Celery-очередями и ML",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(orders_router) # <-- Добавили заказы

app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/")
async def root():
    return FileResponse("app/static/index.html")

@app.get("/health")
async def health_check():
    return JSONResponse(
        content={"status": "healthy", "service": "marketplace-api", "timestamp": time.time()},
        status_code=200,
    )