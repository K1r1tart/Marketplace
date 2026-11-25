# 🛒 Marketplace API

Полноценный модульный маркетплейс с асинхронной обработкой задач, динамическим ценообразованием и внешними интеграциями.

![CI/CD](https://github.com/K1r1tart/Marketplace/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

## 🚀 Особенности проекта

- **Модульная архитектура:** Чёткое разделение на `auth`, `catalog`, `orders`, `notifications`, `analytics`, `delivery`.
- **ML-элементы:** Динамическое ценообразование на основе счётчика просмотров товаров (Celery Beat).
- **Высокая производительность:** Кэширование каталога и рекомендаций в Redis с событийной инвалидацией.
- **Асинхронность:** Все операции с БД и внешними сервисами через `asyncio` и Celery-очереди.
- **3 внешние интеграции:** 
  1. Отправка HTML-чеков через Gmail SMTP.
  2. Эмуляция платёжного шлюза (Mock Payment Gateway).
  3. Эмуляция сервиса доставки (расчёт стоимости).
- **Мониторинг:** Эндпоинты `/health` и `/metrics` (Prometheus format).
- **Современный UI:** Tailwind CSS, тёмная тема, toast-уведомления, скелетоны загрузки.

## 🏗 Архитектура системы

```mermaid
graph TD
    Client[Frontend: Vanilla JS + Tailwind] -->|HTTP/REST| API[FastAPI App]
    API -->|SQL Async| DB[(PostgreSQL)]
    API -->|Cache| Redis[(Redis)]
    API -->|Publish Task| RMQ[RabbitMQ]
    RMQ -->|Consume| CW[Celery Worker]
    CB[Celery Beat] -->|Schedule| CW
    CW -->|Read/Write| DB
    CW -->|Send Email| SMTP[Gmail SMTP]
    CW -->|Mock API| Payment[Mock Payment]
    CW -->|Mock API| Delivery[Mock Delivery]
    
    subgraph CI/CD
    GH[GitHub Actions] -->|Lint & Test| API
    GH -->|Build| Docker[Docker Image]
    end