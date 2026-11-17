from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import models, schemas
from app.auth.security import hash_password, verify_password, create_access_token


async def register_user(db: AsyncSession, data: schemas.UserCreate) -> models.User:
    existing = await db.execute(
        select(models.User).where(models.User.email == data.email)
    )
    if existing.scalar_one_or_none():
        return None  # сигнал "email занят"
    user = models.User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> models.User | None:
    result = await db.execute(select(models.User).where(models.User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def make_token(user: models.User) -> schemas.Token:
    return schemas.Token(
        access_token=create_access_token(user.email, user.role),
    )