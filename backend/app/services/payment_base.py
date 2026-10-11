from dataclasses import dataclass
from typing import Callable, Protocol

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