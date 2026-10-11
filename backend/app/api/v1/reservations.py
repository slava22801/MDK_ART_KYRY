from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session, require_admin
from app.core.config import settings
from app.models.reservation import ReservationStatus
from app.models.user import User, UserRole
from app.schemas.reservation import (
    AdminReservationUpdate,
    ReservationCreate,
    ReservationRead,
    ReservationWithPayment,
)
from app.services import reservations as reservations_service
from app.services.payment import get_payment_provider

router = APIRouter()


@router.post("", response_model=ReservationWithPayment, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    payload: ReservationCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> ReservationWithPayment:
    provider = get_payment_provider(settings.payment_provider)
    try:
        reservation, payment_url = await reservations_service.create_reservation(
            session=session,
            user=user,
            payload=payload,
            payment_provider=provider,
            frontend_base_url=settings.frontend_base_url,
        )
    except reservations_service.ReservationError as exc:
        code = "table_unavailable" if exc.code == "table_unavailable" else exc.code
        http_code = status.HTTP_409_CONFLICT if code == "table_unavailable" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=http_code, detail=exc.message) from exc

    out = ReservationRead.model_validate(reservation).model_dump()
    out["payment_url"] = payment_url
    return ReservationWithPayment.model_validate(out)


@router.get("/me", response_model=list[ReservationRead])
async def my_reservations(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[ReservationRead]:
    rows = await reservations_service.my_reservations(session, user)
    return [ReservationRead.model_validate(r) for r in rows]


@router.get("/{reservation_id}", response_model=ReservationRead)
async def get_reservation(
    reservation_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> ReservationRead:
    is_admin = user.role == UserRole.ADMIN
    reservation = await reservations_service.get_reservation_for_user(
        session, user, reservation_id, is_admin=is_admin
    )
    if reservation is None:
        raise HTTPException(status_code=404, detail="not found")
    return ReservationRead.model_validate(reservation)


@router.post("/{reservation_id}/cancel", response_model=ReservationRead)
async def cancel_reservation(
    reservation_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> ReservationRead:
    try:
        reservation = await reservations_service.cancel_by_user(
            session, user, reservation_id
        )
    except reservations_service.ReservationError as exc:
        if exc.code == "not_found":
            raise HTTPException(status_code=404, detail=exc.message) from exc
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return ReservationRead.model_validate(reservation)


@router.get("/admin/reservations", response_model=list[ReservationRead])
async def admin_list_reservations(
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> list[ReservationRead]:
    rows = await reservations_service.list_all_reservations(session)
    return [ReservationRead.model_validate(r) for r in rows]


@router.patch("/admin/reservations/{reservation_id}", response_model=ReservationRead)
async def admin_update_reservation(
    reservation_id: int,
    payload: AdminReservationUpdate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> ReservationRead:
    reservation = await reservations_service.get_reservation(session, reservation_id)
    if reservation is None:
        raise HTTPException(status_code=404, detail="not found")
    if payload.status is None:
        raise HTTPException(status_code=400, detail="nothing to update")
    updated = await reservations_service.admin_update_reservation(
        session, reservation, ReservationStatus(payload.status)
    )
    return ReservationRead.model_validate(updated)