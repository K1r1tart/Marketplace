from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import time

from app.common.database import engine, Base
from app.auth import models as auth_models  # noqa: F401
from app.catalog import models as catalog_models  # noqa: F401 (регистрирует таблицу products)
from app.auth.router import router as auth_router
from app.catalog.router import router as catalog_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="Marketplace API",
    description="Модульный маркетплейс с RBAC, асинхронными задачами и ML",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(auth_router)
app.include_router(catalog_router)  # <-- Добавили роутер каталога

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