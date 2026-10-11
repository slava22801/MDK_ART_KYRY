from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.reservation import Reservation, ReservationStatus
from app.models.table import Table
from app.models.user import User
from app.schemas.reservation import ReservationCreate


class ReservationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _active_filter(now: datetime):
    """Predicate: reservation is currently 'active' (blocks availability / insertion)."""
    return and_(
        Reservation.status.in_(
            [ReservationStatus.PENDING_PAYMENT, ReservationStatus.CONFIRMED]
        ),
        # expired pending are no longer active
        ~(
            (Reservation.status == ReservationStatus.PENDING_PAYMENT)
            & (Reservation.hold_expires_at.is_not(None))
            & (Reservation.hold_expires_at < now)
        ),
    )


async def get_available_tables(
    session: AsyncSession, start_time: datetime, guests_count: int
) -> list[Table]:
    end_time = start_time + timedelta(minutes=settings.reservation_default_duration_min)
    now = datetime.now(timezone.utc)

    overlapping = (
        select(Reservation.id)
        .where(
            Reservation.table_id == Table.id,
            Reservation.time_range.op("&&")(
                func.tstzrange(start_time, end_time, "[)")
            ),
            _active_filter(now),
        )
        .exists()
    )

    stmt = (
        select(Table)
        .where(
            Table.is_active.is_(True),
            Table.capacity >= guests_count,
            ~overlapping,
        )
        .order_by(Table.number)
    )
    result = await session.scalars(stmt)
    return list(result)


async def _expire_pending_for_table(
    session: AsyncSession, table_id: int, now: datetime
) -> None:
    """Marks expired pending_payment holds as cancelled_timeout for the table.
    Done before insert so exclusion constraint only sees valid active holds."""
    await session.execute(
        update(Reservation)
        .where(
            Reservation.table_id == table_id,
            Reservation.status == ReservationStatus.PENDING_PAYMENT,
            Reservation.hold_expires_at.is_not(None),
            Reservation.hold_expires_at < now,
        )
        .values(status=ReservationStatus.CANCELLED_TIMEOUT)
    )


async def cancel_expired_pending(session: AsyncSession) -> int:
    """Periodic cleanup job. Returns number of cancelled rows."""
    now = datetime.now(timezone.utc)
    result = await session.execute(
        update(Reservation)
        .where(
            Reservation.status == ReservationStatus.PENDING_PAYMENT,
            Reservation.hold_expires_at.is_not(None),
            Reservation.hold_expires_at < now,
        )
        .values(status=ReservationStatus.CANCELLED_TIMEOUT)
        .returning(Reservation.id)
    )
    await session.commit()
    return len(result.scalars().all())


async def create_reservation(
    session: AsyncSession,
    user: User,
    payload: ReservationCreate,
    payment_provider,
    frontend_base_url: str,
) -> tuple[Reservation, str | None]:
    now = datetime.now(timezone.utc)
    if payload.start_time < now:
        raise ReservationError("invalid_time", "start_time must be in the future")

    end_time = payload.start_time + timedelta(
        minutes=settings.reservation_default_duration_min
    )

    table = await session.get(Table, payload.table_id)
    if table is None or not table.is_active:
        raise ReservationError("table_not_found", "table not available")
    if table.capacity < payload.guests_count:
        raise ReservationError(
            "capacity_mismatch",
            f"table capacity is {table.capacity}, requested {payload.guests_count}",
        )

    await _expire_pending_for_table(session, table.id, now)

    reservation = Reservation(
        user_id=user.id,
        table_id=table.id,
        start_time=payload.start_time,
        end_time=end_time,
        guests_count=payload.guests_count,
        status=ReservationStatus.PENDING_PAYMENT,
        deposit_amount=settings.deposit_amount,
        hold_expires_at=now + timedelta(minutes=settings.reservation_hold_min),
    )
    session.add(reservation)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ReservationError("table_unavailable", "table is already booked for this time") from exc

    intent = payment_provider.create_payment(reservation, frontend_base_url)
    reservation.payment_id = intent.payment_id
    reservation.payment_provider = payment_provider.name

    await session.commit()
    await session.refresh(reservation)
    return reservation, intent.payment_url


async def confirm_payment(session: AsyncSession, payment_id: str) -> Reservation | None:
    stmt = select(Reservation).where(Reservation.payment_id == payment_id)
    reservation = await session.scalar(stmt)
    if reservation is None:
        return None
    if reservation.status == ReservationStatus.CONFIRMED:
        return reservation
    if reservation.status not in (ReservationStatus.PENDING_PAYMENT,):
        return reservation
    reservation.status = ReservationStatus.CONFIRMED
    reservation.hold_expires_at = None
    await session.commit()
    await session.refresh(reservation)
    return reservation


async def cancel_by_user(
    session: AsyncSession, user: User, reservation_id: int
) -> Reservation:
    reservation = await session.get(Reservation, reservation_id)
    if reservation is None or reservation.user_id != user.id:
        raise ReservationError("not_found", "reservation not found")
    if reservation.status not in (
        ReservationStatus.PENDING_PAYMENT,
        ReservationStatus.CONFIRMED,
    ):
        raise ReservationError("not_cancellable", f"status is {reservation.status.value}")
    reservation.status = ReservationStatus.CANCELLED_USER
    await session.commit()
    await session.refresh(reservation)
    return reservation


async def my_reservations(session: AsyncSession, user: User) -> list[Reservation]:
    stmt = (
        select(Reservation)
        .where(Reservation.user_id == user.id)
        .order_by(Reservation.start_time.desc())
    )
    result = await session.scalars(stmt)
    return list(result)


async def get_reservation_for_user(
    session: AsyncSession, user: User, reservation_id: int, *, is_admin: bool
) -> Reservation | None:
    reservation = await session.get(Reservation, reservation_id)
    if reservation is None:
        return None
    if not is_admin and reservation.user_id != user.id:
        return None
    return reservation


async def get_reservation(session: AsyncSession, reservation_id: int) -> Reservation | None:
    return await session.get(Reservation, reservation_id)


async def list_all_reservations(session: AsyncSession) -> list[Reservation]:
    stmt = select(Reservation).order_by(Reservation.start_time.desc())
    result = await session.scalars(stmt)
    return list(result)


async def admin_update_reservation(
    session: AsyncSession, reservation: Reservation, new_status: ReservationStatus
) -> Reservation:
    reservation.status = new_status
    await session.commit()
    await session.refresh(reservation)
    return reservation