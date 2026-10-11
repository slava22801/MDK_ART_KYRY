from typing import Literal

from pydantic import BaseModel


class PaymentWebhookPayload(BaseModel):
    payment_id: str
    reservation_id: int
    status: Literal["succeeded", "failed"]
    provider: str | None = None