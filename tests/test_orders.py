import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_order_flow(client: AsyncClient):
    """FR-04 + FR-05: Полный сценарий оформления заказа"""
    await client.post(
        "/auth/register",
        json={"email": "seller@test.com", "password": "123", "role": "seller"},
    )
    resp_login = await client.post(
        "/auth/login", data={"username": "seller@test.com", "password": "123"}
    )
    token = resp_login.json()["access_token"]
    headers_seller = {"Authorization": f"Bearer {token}"}

    resp_product = await client.post(
        "/products/",
        headers=headers_seller,
        json={
            "title": "Test Laptop",
            "description": "For testing",
            "price": 50000.0,
            "stock": 10,
            "category": "electronics",
        },
    )
    assert resp_product.status_code == 201
    product_id = resp_product.json()["id"]

    await client.post(
        "/auth/register",
        json={"email": "buyer@test.com", "password": "123", "role": "buyer"},
    )
    resp_login_buyer = await client.post(
        "/auth/login", data={"username": "buyer@test.com", "password": "123"}
    )
    token_buyer = resp_login_buyer.json()["access_token"]
    headers_buyer = {"Authorization": f"Bearer {token_buyer}"}

    resp_order = await client.post(
        "/orders/",
        headers=headers_buyer,
        json={"items": [{"product_id": product_id, "quantity": 2}]},
    )
    assert resp_order.status_code == 201
    order_data = resp_order.json()
    assert order_data["total_amount"] == 100000.0
    assert order_data["status"] == "pending"
    assert len(order_data["items"]) == 1