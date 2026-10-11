from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.core.config import settings
from app.models.reservation import Reservation
from app.services import reservations as reservations_service
from app.services.payment import get_payment_provider

router = APIRouter()


@router.post("/payment/{reservation_id}/confirm")
async def dev_confirm_payment(
    reservation_id: int, session: AsyncSession = Depends(get_session)
) -> dict[str, str]:
    """Stub-only: imitates a successful payment webhook for local development.

    URL: POST /api/v1/dev/payment/{id}/confirm
    """
    if settings.payment_provider != "stub":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="dev endpoint disabled when payment_provider != 'stub'",
        )

    reservation = await session.get(Reservation, reservation_id)
    if reservation is None:
        raise HTTPException(status_code=404, detail="reservation not found")
    if reservation.payment_id is None:
        raise HTTPException(status_code=400, detail="reservation has no payment")

    updated = await reservations_service.confirm_payment(session, reservation.payment_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="reservation not found")
    return {"status": "ok", "reservation_id": str(updated.id), "state": updated.status.value}