import json

from app.models.reservation import Reservation
from app.services.payment_base import (
    PaymentIntent,
    PaymentProvider,
    WebhookResult,
    register_provider,
)


@register_provider("stub")
class StubPaymentProvider:
    name = "stub"

    def create_payment(self, reservation: Reservation, frontend_base_url: str) -> PaymentIntent:
        payment_id = f"stub_{reservation.id}_{reservation.payment_id or ''}"
        payment_url = f"{frontend_base_url.rstrip('/')}/payment/{reservation.id}"
        return PaymentIntent(payment_id=payment_id, payment_url=payment_url)

    def verify_webhook(self, raw_body: bytes, signature: str | None) -> WebhookResult:
        payload = json.loads(raw_body or b"{}")
        succeeded = payload.get("status") == "succeeded"
        return WebhookResult(
            reservation_id=int(payload["reservation_id"]),
            payment_id=str(payload["payment_id"]),
            succeeded=succeeded,
        )