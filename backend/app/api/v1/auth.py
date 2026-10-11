from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import TokenRead, UserCreate, UserLogin, UserRead

router = APIRouter()


@router.post("/register", response_model=TokenRead, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate, session: AsyncSession = Depends(get_session)
) -> TokenRead:
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        name=payload.name,
        phone=payload.phone,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="email already registered") from exc
    await session.refresh(user)

    token = create_access_token(user.id, extra={"role": user.role.value})
    return TokenRead(access_token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenRead)
async def login(
    payload: UserLogin, session: AsyncSession = Depends(get_session)
) -> TokenRead:
    stmt = select(User).where(User.email == payload.email.lower())
    user = await session.scalar(stmt)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")

    token = create_access_token(user.id, extra={"role": user.role.value})
    return TokenRead(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user)