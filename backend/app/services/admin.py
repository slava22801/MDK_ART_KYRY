from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reservation import Reservation, ReservationStatus


async def dashboard_stats(session: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    week_start = today_start - timedelta(days=today_start.weekday())

    async def count(status: ReservationStatus, since: datetime) -> int:
        stmt = select(func.count(Reservation.id)).where(
            Reservation.status == status, Reservation.created_at >= since
        )
        return int((await session.scalar(stmt)) or 0)

    async def sum_deposit(statuses: list[ReservationStatus], since: datetime) -> int:
        stmt = select(func.coalesce(func.sum(Reservation.deposit_amount), 0)).where(
            Reservation.status.in_(statuses), Reservation.created_at >= since
        )
        return int((await session.scalar(stmt)) or 0)

    today_confirmed = await count(ReservationStatus.CONFIRMED, today_start)
    today_pending = await count(ReservationStatus.PENDING_PAYMENT, today_start)
    today_cancelled = await count(ReservationStatus.CANCELLED_TIMEOUT, today_start)

    week_revenue = await sum_deposit([ReservationStatus.CONFIRMED], week_start)
    total_revenue = await sum_deposit([ReservationStatus.CONFIRMED], datetime(1970, 1, 1, tzinfo=timezone.utc))

    upcoming_stmt = (
        select(func.count(Reservation.id))
        .where(
            Reservation.status.in_(
                [ReservationStatus.CONFIRMED, ReservationStatus.PENDING_PAYMENT]
            ),
            Reservation.start_time >= now,
            Reservation.start_time < tomorrow_start + timedelta(days=6),
        )
    )
    upcoming_7d = int((await session.scalar(upcoming_stmt)) or 0)

    return {
        "today": {
            "confirmed": today_confirmed,
            "pending_payment": today_pending,
            "cancelled_timeout": today_cancelled,
        },
        "revenue_week": week_revenue,
        "revenue_total": total_revenue,
        "upcoming_7d": upcoming_7d,
    }