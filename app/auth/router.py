from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.database import get_db
from app.auth import models, schemas, service
from app.auth.dependencies import get_current_user, require_role

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut, status_code=201)
async def register(
    data: schemas.UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await service.register_user(db, data)
    if user is None:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    return user


# Этот эндпоинт — специально для Swagger OAuth2 flow (принимает form-data с username)
@router.post("/login", response_model=schemas.Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # В OAuth2 form-data поле называется "username", но у нас это email
    user = await service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return service.make_token(user)


# Сохраняем старый JSON-эндпоинт для нашего фронтенда (он шлёт JSON)
@router.post("/login-json", response_model=schemas.Token, include_in_schema=False)
async def login_json(
    data: schemas.UserLogin,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await service.authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    return service.make_token(user)


@router.get("/me", response_model=schemas.UserOut)
async def me(current_user: Annotated[models.User, Depends(get_current_user)]):
    return current_user


@router.get(
    "/admin/users",
    response_model=list[schemas.UserOut],
    dependencies=[Depends(require_role(["admin"]))],
)
async def list_users(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(models.User))
    return result.scalars().all()