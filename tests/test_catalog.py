import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_public_catalog(client: AsyncClient):
    """FR-03: Каталог доступен без авторизации"""
    response = await client.get("/products/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_filter_by_category(client: AsyncClient):
    """FR-03: Фильтрация по категории"""
    # Создаем товар
    await client.post(
        "/auth/register",
        json={"email": "seller_cat@test.com", "password": "123", "role": "seller"},
    )
    login = await client.post(
        "/auth/login", data={"username": "seller_cat@test.com", "password": "123"}
    )
    token = login.json()["access_token"]
    
    await client.post(
        "/products/",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Electronics Item", "price": 1000.0, "stock": 5, "category": "electronics"},
    )
    
    # Фильтруем
    response = await client.get("/products/?category=electronics")
    assert response.status_code == 200
    for product in response.json():
        assert product["category"] == "electronics"


@pytest.mark.asyncio
async def test_seller_can_create_product(client: AsyncClient):
    """FR-02: Продавец может создавать товары"""
    await client.post(
        "/auth/register",
        json={"email": "seller_create@test.com", "password": "123", "role": "seller"},
    )
    login = await client.post(
        "/auth/login", data={"username": "seller_create@test.com", "password": "123"}
    )
    token = login.json()["access_token"]
    
    response = await client.post(
        "/products/",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "New Product", "price": 500.0, "stock": 10, "category": "books"},
    )
    assert response.status_code == 201
    assert response.json()["title"] == "New Product"


@pytest.mark.asyncio
async def test_buyer_cannot_create_product(client: AsyncClient):
    """FR-02 + NFR Безопасность: Покупатель не может создавать товары"""
    await client.post(
        "/auth/register",
        json={"email": "buyer_forbid@test.com", "password": "123", "role": "buyer"},
    )
    login = await client.post(
        "/auth/login", data={"username": "buyer_forbid@test.com", "password": "123"}
    )
    token = login.json()["access_token"]
    
    response = await client.post(
        "/products/",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Forbidden", "price": 100.0, "stock": 1, "category": "other"},
    )
    assert response.status_code == 403