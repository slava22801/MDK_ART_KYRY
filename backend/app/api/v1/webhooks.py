from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.core.config import settings
from app.services import reservations as reservations_service
from app.services.payment import get_payment_provider

router = APIRouter()


@router.post("/payment")
async def payment_webhook(
    request: Request,
    x_signature: str | None = Header(default=None, alias="X-Signature"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    raw = await request.body()
    provider = get_payment_provider(settings.payment_provider)
    try:
        result = provider.verify_webhook(raw, x_signature)
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"invalid webhook: {exc}") from exc

    if result.succeeded:
        reservation = await reservations_service.confirm_payment(session, result.payment_id)
        if reservation is None:
            raise HTTPException(status_code=404, detail="reservation not found")
    return {"status": "ok"}