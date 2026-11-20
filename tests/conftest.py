import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.main import app
from app.common.database import get_db, Base

# Используем SQLite в памяти для быстрых и полностью изолированных тестов
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture
async def test_engine():
    """Создаем тестовый движок БД и таблицы для КАЖДОГО теста отдельно"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def db_session(test_engine):
    """Создаем сессию для каждого теста"""
    async with AsyncSession(test_engine) as session:
        yield session

@pytest.fixture
async def client(db_session):
    """Создаем тестовый HTTP-клиент и подменяем зависимость БД"""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
        
    app.dependency_overrides.clear()