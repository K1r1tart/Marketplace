from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator
import os
import time

from app.common.database import engine, Base
from app.auth import models as auth_models
from app.catalog import models as catalog_models
from app.orders import models as order_models

from app.auth.router import router as auth_router
from app.catalog.router import router as catalog_router
from app.orders.router import router as orders_router
from app.admin.router import router as admin_router  

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

Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(orders_router)
app.include_router(admin_router)  

# === ВАЖНО: ПРАВИЛЬНОЕ МОНТИРОВАНИЕ СТАТИКИ ===
os.makedirs("app/static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/static/uploads", StaticFiles(directory="app/static/uploads"), name="uploads")


@app.get("/")
async def root():
    return FileResponse("app/static/index.html")

@app.get("/health")
async def health_check():
    return JSONResponse(
        content={"status": "healthy", "service": "marketplace-api", "timestamp": time.time()},
        status_code=200,
    )