# 🛒 Marketplace

Полнофункциональный модульный маркетплейс с асинхронной обработкой задач, кэшированием, рекомендательной системой и реальными внешними интеграциями.

![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Tests](https://img.shields.io/badge/Tests-pytest-brightgreen)

## ⚠️ Важно: тестовый режим платежей

Интеграция с платёжным шлюзом **ЮKassa** работает в **тестовом режиме (sandbox)**. Это означает:
- Реальные деньги **не списываются**.
- Для тестирования оплаты используются специальные тестовые карты (например, `1111 1111 1111 1026`).
- Все платежи отображаются в личном кабинете ЮKassa с пометкой "Тестовый магазин".
- Для перехода в production-режим необходимо заменить тестовые ключи API на боевые в файле `.env`.

## ✨ Ключевые особенности

- 🏗 **Модульная архитектура**: Чёткое разделение на `auth`, `catalog`, `orders`, `payments`, `delivery`, `notifications`, `analytics` и `admin`.
- ⚡ **Асинхронность**: FastAPI + SQLAlchemy 2.0 (async) + asyncpg для высокой производительности.
- 🧠 **Рекомендательная система**: Контентная фильтрация на основе категории и ранжирование по популярности (`views`), с исключением товаров с нулевым остатком.
- 🚀 **Фоновые задачи**: Celery + RabbitMQ для асинхронной отправки email-чеков и динамического пересчёта цен.
- 💳 **Реальная интеграция**: Платёжный шлюз ЮKassa (Sandbox) с созданием платежей и проверкой статуса.
- 📧 **Email-уведомления**: Отправка HTML-чеков через Gmail SMTP (с graceful degradation при недоступности).
- 👥 **Ролевая модель (RBAC)**: Строгое разграничение прав для `buyer`, `seller` и `admin`.
- 🛡 **Мягкое удаление (Soft Delete)**: Защита ссылочной целостности БД — товары, участвующие в заказах, нельзя удалить физически, их можно только деактивировать (`stock = 0`).
- ✅ **Автотесты**: Покрытие ключевых сценариев (Auth, CRUD, Orders, RBAC, Health) с помощью `pytest` и `httpx`.
- 🌙 **Современный UI**: Адаптивный SPA на Vanilla JS + Tailwind CSS с поддержкой тёмной темы, toast-уведомлениями и скелетонами загрузки.

## 🏗 Архитектура

```mermaid
graph TD
    Client[Frontend: Vanilla JS + Tailwind] -->|REST + JWT| API[FastAPI App]
    API -->|async SQL| DB[(PostgreSQL)]
    API -->|cache| Redis[(Redis)]
    API -->|publish| RMQ[RabbitMQ]
    RMQ -->|consume| CW[Celery Worker]
    CW -->|read/write| DB
    CW -->|SMTP| Gmail[Gmail: HTML-чеки]
    API -->|Payment API| YK[ЮKassa Sandbox]