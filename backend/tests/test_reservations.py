"""Интеграционные тесты по сценариям бронирования."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from app.models.reservation import Reservation, ReservationStatus
from app.models.table import Table

URL = "/api/v1/reservations"
TABLES_URL = "/api/v1/tables"


def _future_iso(days_ahead: int = 1, hour: int = 19) -> str:
    dt = datetime.now(timezone.utc) + timedelta(days=days_ahead)
    dt = dt.replace(hour=hour, minute=0, second=0, microsecond=0)
    return dt.isoformat()


@pytest.mark.asyncio
async def test_availability_returns_only_free_tables(client, three_tables, client_token):
    start = _future_iso()
    r = await client.get(
        TABLES_URL + "/availability",
        params={"start_time": start, "guests_count": 2},
    )
    assert r.status_code == 200
    ids = {t["id"] for t in r.json()}
    active_ids = {t.id for t in three_tables if t.is_active}
    assert ids == active_ids

    # Для 8 гостей — только стол на 10 (но он OFF), ничего не вернётся
    r2 = await client.get(
        TABLES_URL + "/availability",
        params={"start_time": start, "guests_count": 8},
    )
    assert r2.json() == []


@pytest.mark.asyncio
async def test_availability_excludes_inactive(client, three_tables, client_token):
    r = await client.get(
        TABLES_URL + "/availability",
        params={"start_time": _future_iso(), "guests_count": 8},
    )
    ids = {t["id"] for t in r.json()}
    off_id = next(t.id for t in three_tables if not t.is_active)
    assert off_id not in ids


@pytest.mark.asyncio
async def test_create_reservation_holds_table(client, three_tables, client_token):
    start = _future_iso()
    r = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pending_payment"
    assert body["deposit_amount"] == 500
    assert body["hold_expires_at"] is not None
    assert body["payment_url"] is not None
    assert body["payment_id"] is not None


@pytest.mark.asyncio
async def test_overbooking_blocked_by_exclusion_constraint(
    client, three_tables, client_token, second_client_token
):
    """Главная фича: 2 брони на один стол в одно время → вторая даёт 409."""
    start = _future_iso()

    r1 = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r1.status_code == 201, r1.text

    r2 = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {second_client_token}"},
    )
    assert r2.status_code == 409, r2.text
    assert "already booked" in r2.json()["detail"].lower() or "table" in r2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_overbooking_blocked_even_after_partial_overlap(
    client, three_tables, client_token, second_client_token
):
    """Бронь пересекается лишь частично — всё равно блокируется."""
    start = datetime.fromisoformat(_future_iso())

    r1 = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start.isoformat(), "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r1.status_code == 201

    # +30 минут от того же начала — пересечение есть
    later = start + timedelta(minutes=30)
    r2 = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": later.isoformat(), "guests_count": 2},
        headers={"Authorization": f"Bearer {second_client_token}"},
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_overbooking_allowed_on_different_tables(
    client, three_tables, client_token, second_client_token
):
    """Одно время — разные столы — обе брони проходят."""
    start = _future_iso()

    r1 = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    r2 = await client.post(
        URL,
        json={"table_id": three_tables[1].id, "start_time": start, "guests_count": 4},
        headers={"Authorization": f"Bearer {second_client_token}"},
    )
    assert r1.status_code == 201
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_capacity_check(client, three_tables, client_token):
    r = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": _future_iso(), "guests_count": 10},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 400
    assert "capacity" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_past_time_rejected(client, three_tables, client_token):
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    r = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": past, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_confirm_payment_via_webhook(client, three_tables, client_token):
    start = _future_iso()
    create = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert create.status_code == 201
    reservation_id = create.json()["id"]
    payment_id = create.json()["payment_id"]

    r = await client.post(
        "/api/v1/webhooks/payment",
        json={"payment_id": payment_id, "reservation_id": reservation_id, "status": "succeeded"},
    )
    assert r.status_code == 200

    r_get = await client.get(
        f"{URL}/{reservation_id}", headers={"Authorization": f"Bearer {client_token}"}
    )
    assert r_get.json()["status"] == "confirmed"
    assert r_get.json()["hold_expires_at"] is None


@pytest.mark.asyncio
async def test_confirm_payment_idempotent(client, three_tables, client_token):
    """Двойной вебхук с тем же payment_id не ломает ничего."""
    start = _future_iso()
    create = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    res_id = create.json()["id"]
    payment_id = create.json()["payment_id"]

    for _ in range(2):
        r = await client.post(
            "/api/v1/webhooks/payment",
            json={"payment_id": payment_id, "reservation_id": res_id, "status": "succeeded"},
        )
        assert r.status_code == 200


@pytest.mark.asyncio
async def test_dev_confirm_payment_stub_only(
    client, three_tables, client_token
):
    start = _future_iso()
    create = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    res_id = create.json()["id"]

    r = await client.post(f"/api/v1/dev/payment/{res_id}/confirm")
    assert r.status_code == 200
    assert r.json()["state"] == "confirmed"


@pytest.mark.asyncio
async def test_cancel_by_user(client, three_tables, client_token):
    create = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": _future_iso(), "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    res_id = create.json()["id"]
    r = await client.post(
        f"{URL}/{res_id}/cancel",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled_user"


@pytest.mark.asyncio
async def test_cannot_cancel_other_users_reservation(
    client, three_tables, client_token, second_client_token
):
    create = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": _future_iso(), "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    res_id = create.json()["id"]
    r = await client.post(
        f"{URL}/{res_id}/cancel",
        headers={"Authorization": f"Bearer {second_client_token}"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_my_reservations_returns_only_own(
    client, three_tables, client_token, second_client_token
):
    await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": _future_iso(hour=12), "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    await client.post(
        URL,
        json={"table_id": three_tables[1].id, "start_time": _future_iso(hour=13), "guests_count": 4},
        headers={"Authorization": f"Bearer {second_client_token}"},
    )

    r = await client.get(
        f"{URL}/me", headers={"Authorization": f"Bearer {client_token}"}
    )
    assert r.status_code == 200
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_expired_hold_releases_table(client, three_tables, client_token, session_factory):
    """Имитируем истёкший hold: pending_payment + hold_expires_at в прошлом
    должен позволять новую бронь на тот же стол/время."""
    start = _future_iso()
    r1 = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r1.status_code == 201
    res_id = r1.json()["id"]

    # Принудительно старим hold
    async with session_factory() as s:
        await s.execute(
            update(Reservation)
            .where(Reservation.id == res_id)
            .values(hold_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        )
        await s.commit()

    # Вторая бронь на тот же слот — должна пройти
    r2 = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r2.status_code == 201, r2.text


@pytest.mark.asyncio
async def test_cancel_expired_pending_job(client, three_tables, client_token, session_factory):
    """cancel_expired_pending переводит истёкшие pending → cancelled_timeout."""
    from app.services.reservations import cancel_expired_pending

    start = _future_iso()
    create = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": start, "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    res_id = create.json()["id"]

    async with session_factory() as s:
        await s.execute(
            update(Reservation)
            .where(Reservation.id == res_id)
            .values(hold_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        )
        await s.commit()

        n = await cancel_expired_pending(s)
        assert n == 1

        res = await s.scalar(select(Reservation).where(Reservation.id == res_id))
        assert res.status == ReservationStatus.CANCELLED_TIMEOUT


@pytest.mark.asyncio
async def test_admin_can_list_all_reservations(
    client, three_tables, client_token, admin_token
):
    await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": _future_iso(), "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    r = await client.get(
        f"{URL}/admin/reservations",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert len(r.json()) >= 1


@pytest.mark.asyncio
async def test_admin_can_change_status(
    client, three_tables, client_token, admin_token
):
    create = await client.post(
        URL,
        json={"table_id": three_tables[0].id, "start_time": _future_iso(), "guests_count": 2},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    res_id = create.json()["id"]

    r = await client.patch(
        f"{URL}/admin/reservations/{res_id}",
        json={"status": "cancelled_admin"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled_admin"


@pytest.mark.asyncio
async def test_admin_endpoints_forbidden_for_client(
    client, three_tables, client_token
):
    r = await client.get(
        f"{URL}/admin/reservations",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 403