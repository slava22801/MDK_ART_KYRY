import pytest


@pytest.mark.asyncio
async def test_list_tables_public(client, three_tables):
    r = await client.get("/api/v1/tables")
    assert r.status_code == 200
    ids = {t["id"] for t in r.json()}
    # публичный — только активные
    active = {t.id for t in three_tables if t.is_active}
    assert ids == active


@pytest.mark.asyncio
async def test_admin_list_all_includes_inactive(client, three_tables, admin_token):
    r = await client.get(
        "/api/v1/tables/admin/tables/all",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert len(r.json()) == len(three_tables)


@pytest.mark.asyncio
async def test_admin_create_table(client, admin_token):
    r = await client.post(
        "/api/v1/tables/admin/tables",
        json={"number": "Z9", "capacity": 4, "is_active": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    assert r.json()["number"] == "Z9"


@pytest.mark.asyncio
async def test_admin_update_table(client, three_tables, admin_token):
    r = await client.patch(
        f"/api/v1/tables/admin/tables/{three_tables[0].id}",
        json={"capacity": 10, "is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["capacity"] == 10
    assert r.json()["is_active"] is False


@pytest.mark.asyncio
async def test_admin_delete_table(client, three_tables, admin_token):
    r = await client.delete(
        f"/api/v1/tables/admin/tables/{three_tables[0].id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_table_admin_forbidden_for_client(client, three_tables, client_token):
    r = await client.get(
        "/api/v1/tables/admin/tables/all",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_table_admin_requires_auth(client):
    r = await client.post(
        "/api/v1/tables/admin/tables",
        json={"number": "Z9", "capacity": 4, "is_active": True},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_create_table_duplicate_number_fails(client, three_tables, admin_token):
    r = await client.post(
        "/api/v1/tables/admin/tables",
        json={"number": three_tables[0].number, "capacity": 4, "is_active": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code in (409, 500)  # либо explicit, либо constraint