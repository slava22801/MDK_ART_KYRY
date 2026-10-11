import json

from app.models.reservation import Reservation
from app.services.payment_base import (
    PaymentIntent,
    PaymentProvider,
    WebhookResult,
    compute_webhook_signature,
    register_provider,
    verify_webhook_signature,
)


@register_provider("stub")
class StubPaymentProvider:
    name = "stub"

    def create_payment(self, reservation: Reservation, frontend_base_url: str) -> PaymentIntent:
        payment_id = f"stub_{reservation.id}_{reservation.payment_id or ''}"
        payment_url = f"{frontend_base_url.rstrip('/')}/payment/{reservation.id}"
        return PaymentIntent(payment_id=payment_id, payment_url=payment_url)

    def sign_webhook(self, raw_body: bytes, secret: str) -> str:
        """Помогает тестам и локальной отладке сформировать валидную подпись."""
        return compute_webhook_signature(raw_body, secret)

    def verify_webhook(self, raw_body: bytes, signature: str | None) -> WebhookResult:
        # Раньше подпись просто игнорировалась, и любой, кто знал payment_id
        # (он предсказуем: stub_<id>_), мог подтвердить бронь без оплаты.
        verify_webhook_signature(raw_body, signature)
        payload = json.loads(raw_body or b"{}")
        succeeded = payload.get("status") == "succeeded"
        return WebhookResult(
            reservation_id=int(payload["reservation_id"]),
            payment_id=str(payload["payment_id"]),
            succeeded=succeeded,
        )