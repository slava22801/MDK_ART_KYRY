"""Тесты админ-дашборда и статистики."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.models.reservation import Reservation, ReservationStatus


@pytest.mark.asyncio
async def test_stats_requires_admin(client, client_token):
    r = await client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_stats_empty(client, admin_token):
    r = await client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["today"]["confirmed"] == 0
    assert body["today"]["pending_payment"] == 0
    assert body["today"]["cancelled_timeout"] == 0
    assert body["revenue_week"] == 0
    assert body["revenue_total"] == 0
    assert body["upcoming_7d"] == 0


@pytest.mark.asyncio
async def test_stats_counts_confirmed_today(
    client, three_tables, client_token, admin_token, session_factory
):
    start = datetime.now(timezone.utc) + timedelta(days=1)
    start = start.replace(hour=19, minute=0, second=0, microsecond=0)

    r = await client.post(
        "/api/v1/reservations",
        json={"table_id": three_tables[0].id, "start_time": start.isoformat(), "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 201
    res_id = r.json()["id"]
    payment_id = r.json()["payment_id"]

    await client.post(
        "/api/v1/webhooks/payment",
        json={"payment_id": payment_id, "reservation_id": res_id, "status": "succeeded"},
    )

    stats = (
        await client.get(
            "/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    ).json()

    assert stats["today"]["confirmed"] == 1
    assert stats["revenue_total"] == 500
    assert stats["upcoming_7d"] >= 1


@pytest.mark.asyncio
async def test_stats_excludes_old_confirmed_from_today(
    client, three_tables, client_user, admin_token, session_factory
):
    """Подтверждённая бронь из прошлого месяца не должна попадать в today.confirmed,
    но должна быть в revenue_total."""
    from app.db.session import SessionLocal
    start = datetime.now(timezone.utc) + timedelta(days=2)
    start = start.replace(hour=20, minute=0, second=0, microsecond=0)

    async with SessionLocal() as s:
        res = Reservation(
            user_id=client_user.id,
            table_id=three_tables[0].id,
            start_time=start,
            end_time=start + timedelta(hours=2),
            guests_count=2,
            status=ReservationStatus.CONFIRMED,
            deposit_amount=500,
            payment_id="old_1",
            payment_provider="stub",
        )
        s.add(res)
        # Подделываем created_at на месяц назад
        await s.commit()
        await s.refresh(res)
        await s.execute(
            update(Reservation)
            .where(Reservation.id == res.id)
            .values(created_at=datetime.now(timezone.utc) - timedelta(days=40))
        )
        await s.commit()

    stats = (
        await client.get(
            "/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
    ).json()

    assert stats["today"]["confirmed"] == 0
    assert stats["revenue_total"] == 500