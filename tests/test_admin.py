import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_can_view_stats(client: AsyncClient):
    """FR-09: Администратор может просматривать статистику"""
    await client.post(
        "/auth/register",
        json={"email": "admin_stat@test.com", "password": "123", "role": "admin"},
    )
    login = await client.post(
        "/auth/login", data={"username": "admin_stat@test.com", "password": "123"}
    )
    token = login.json()["access_token"]
    
    response = await client.get(
        "/admin/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "total_products" in data
    assert "total_orders" in data


@pytest.mark.asyncio
async def test_buyer_cannot_access_admin(client: AsyncClient):
    """FR-09 + NFR Безопасность: Покупатель не имеет доступа к админке"""
    await client.post(
        "/auth/register",
        json={"email": "buyer_admin@test.com", "password": "123", "role": "buyer"},
    )
    login = await client.post(
        "/auth/login", data={"username": "buyer_admin@test.com", "password": "123"}
    )
    token = login.json()["access_token"]
    
    response = await client.get(
        "/admin/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403