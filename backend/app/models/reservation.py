import enum
from datetime import datetime

from sqlalchemy import (
    Computed,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import TSTZRANGE
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReservationStatus(str, enum.Enum):
    PENDING_PAYMENT = "pending_payment"
    CONFIRMED = "confirmed"
    CANCELLED_TIMEOUT = "cancelled_timeout"
    CANCELLED_USER = "cancelled_user"
    CANCELLED_ADMIN = "cancelled_admin"
    COMPLETED = "completed"


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    table_id: Mapped[int] = mapped_column(ForeignKey("tables.id"), nullable=False, index=True)

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    guests_count: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[ReservationStatus] = mapped_column(
        Enum(
            ReservationStatus,
            name="reservation_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=ReservationStatus.PENDING_PAYMENT,
        nullable=False,
    )

    deposit_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_id: Mapped[str | None] = mapped_column(String(255), index=True)
    payment_provider: Mapped[str | None] = mapped_column(String(32))

    hold_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    time_range: Mapped[datetime | None] = mapped_column(
        TSTZRANGE,
        Computed("tstzrange(start_time, end_time, '[)')", persisted=True),
        nullable=False,
    )

    __table_args__ = (
        Index(
            "ix_reservations_pending_expiry",
            "hold_expires_at",
            postgresql_where=(status == ReservationStatus.PENDING_PAYMENT),
        ),
    )