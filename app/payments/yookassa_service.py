import os
from yookassa import Configuration, Payment
from yookassa.domain.common.confirmation_type import ConfirmationType

# Настройка ЮKassa
Configuration.account_id = os.getenv('YOOKASSA_SHOP_ID')
Configuration.secret_key = os.getenv('YOOKASSA_SECRET_KEY')


def create_payment(order_id: int, amount: float, description: str) -> dict:
    """Создание платежа через ЮKassa"""
    payment = Payment.create({
        "amount": {
            "value": f"{amount:.2f}",
            "currency": "RUB"
        },
        "confirmation": {
            "type": ConfirmationType.REDIRECT,
            "return_url": os.getenv('YOOKASSA_RETURN_URL', 'http://localhost:8000/payment-success')
        },
        "capture": True,
        "description": description,
        "metadata": {
            "order_id": order_id
        }
    })

    return {
        "payment_id": payment.id,
        "confirmation_url": payment.confirmation.confirmation_url,
        "status": payment.status
    }


def check_payment_status(payment_id: str) -> str:
    """Проверка статуса платежа"""
    payment = Payment.find_one(payment_id)
    return payment.status