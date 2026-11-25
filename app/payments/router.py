from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.common.database import get_db
from app.auth.dependencies import get_current_user
from app.auth import models as user_models
from app.orders import models as order_models
from app.payments.yookassa_service import create_payment, check_payment_status

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/create/{order_id}")
async def create_yookassa_payment(
    order_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(get_current_user)]
):
    """Создать платеж через ЮKassa"""
    result = await db.execute(
        select(order_models.Order).where(order_models.Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому заказу")

    if order.status == "paid":
        raise HTTPException(status_code=400, detail="Заказ уже оплачен")

    total_amount = order.total_amount + (order.delivery_cost or 0)

    try:
        payment_data = create_payment(
            order_id=order_id,
            amount=total_amount,
            description=f"Оплата заказа №{order_id}"
        )

        order.payment_id = payment_data["payment_id"]
        await db.commit()

        return {
            "payment_id": payment_data["payment_id"],
            "confirmation_url": payment_data["confirmation_url"],
            "status": payment_data["status"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка создания платежа: {str(e)}")


@router.get("/status/{payment_id}")
async def get_payment_status(payment_id: str):
    """Проверить статус платежа"""
    try:
        status = check_payment_status(payment_id)
        return {"payment_id": payment_id, "status": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-order/{order_id}")
async def check_order_payment(
    order_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[user_models.User, Depends(get_current_user)]
):
    """Проверить и обновить статус оплаты заказа"""
    result = await db.execute(
        select(order_models.Order).where(order_models.Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if order.status == "paid":
        return {"status": "paid"}

    if order.payment_id:
        try:
            yk_status = check_payment_status(order.payment_id)
            if yk_status == "succeeded":
                order.status = "paid"
                await db.commit()
                # Отправляем чек после успешной оплаты
                from app.auth.models import User
                user_result = await db.execute(select(User).where(User.id == order.user_id))
                user = user_result.scalar_one_or_none()
                if user:
                    from app.notifications.tasks import send_receipt_email_task
                    try:
                        send_receipt_email_task.delay(order.id, user.email)
                    except Exception:
                        pass
                return {"status": "paid"}
            return {"status": yk_status}
        except Exception:
            return {"status": order.status}

    return {"status": order.status}

@router.get("/success")
async def payment_success(order_id: int = Query(None)):
    """Страница успешной оплаты (редирект с ЮKassa)"""
    return {"message": "Оплата прошла успешно", "order_id": order_id}

from fastapi.responses import RedirectResponse

@router.get("/success")
async def payment_success(order_id: int = None):
    """Страница возврата после оплаты ЮKassa — редирект на заказы"""
    if order_id:
        return RedirectResponse(url=f"/?order_id={order_id}", status_code=302)
    return RedirectResponse(url="/", status_code=302)