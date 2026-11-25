import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    """FR-01: Регистрация и вход пользователя"""
    response = await client.post(
        "/auth/register",
        json={
            "email": "testuser@example.com",
            "password": "securepassword123",
            "role": "buyer",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "testuser@example.com"
    assert data["role"] == "buyer"

    response = await client.post(
        "/auth/login",
        data={"username": "testuser@example.com", "password": "securepassword123"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

    response = await client.post(
        "/auth/login",
        data={"username": "testuser@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_without_token(client: AsyncClient):
    """NFR Безопасность: Без токена — 401"""
    response = await client.get("/auth/me")
    assert response.status_code == 401