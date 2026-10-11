import hashlib
import hmac
from dataclasses import dataclass
from typing import Callable, Protocol

from app.core.config import settings
from app.models.reservation import Reservation


@dataclass
class PaymentIntent:
    payment_id: str
    payment_url: str


@dataclass
class WebhookResult:
    reservation_id: int
    payment_id: str
    succeeded: bool


class PaymentProvider(Protocol):
    name: str

    def create_payment(self, reservation: Reservation, frontend_base_url: str) -> PaymentIntent: ...

    def verify_webhook(self, raw_body: bytes, signature: str | None) -> WebhookResult: ...


def compute_webhook_signature(raw_body: bytes, secret: str) -> str:
    """Подпись тела запроса в формате sha256=<hex>."""
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_webhook_signature(
    raw_body: bytes, signature: str | None, *, secret: str | None = None
) -> None:
    """Проверяет HMAC-подпись вебхука. Бросает ValueError при несовпадении.

    Общая точка для всех провайдеров: без неё каждый новый провайдер рискует
    «забыть» проверку и открыть подтверждение броней без оплаты.
    """
    key = secret if secret is not None else settings.payment_webhook_secret
    if not signature:
        raise ValueError("missing signature")
    expected = compute_webhook_signature(raw_body, key)
    # compare_digest — constant-time, чтобы по времени ответа нельзя было подбирать подпись.
    if not hmac.compare_digest(expected, signature):
        raise ValueError("invalid signature")


_providers: dict[str, type[PaymentProvider]] = {}


def register_provider(name: str) -> Callable[[type[PaymentProvider]], type[PaymentProvider]]:
    def decorator(cls: type[PaymentProvider]) -> type[PaymentProvider]:
        _providers[name] = cls
        cls.name = name
        return cls

    return decorator


def get_payment_provider(name: str) -> PaymentProvider:
    cls = _providers.get(name)
    if cls is None:
        raise ValueError(f"unknown payment provider: {name}")
    return cls()