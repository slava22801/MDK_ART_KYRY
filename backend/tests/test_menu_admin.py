import pytest


@pytest.mark.asyncio
async def test_list_menu_public(client, menu_fixtures):
    cat, item = menu_fixtures
    r = await client.get("/api/v1/menu")
    assert r.status_code == 200
    categories = r.json()
    assert len(categories) == 1
    assert categories[0]["name"] == "Горячее"
    assert len(categories[0]["items"]) == 1
    assert categories[0]["items"][0]["name"] == "Стейк"


@pytest.mark.asyncio
async def test_admin_create_category(client, admin_token):
    r = await client.post(
        "/api/v1/menu/admin/menu/categories",
        json={"name": "Салаты", "description": "Свежие", "sort_order": 20},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Салаты"


@pytest.mark.asyncio
async def test_admin_create_item(client, menu_fixtures, admin_token):
    cat, _ = menu_fixtures
    r = await client.post(
        "/api/v1/menu/admin/menu/items",
        json={
            "category_id": cat.id,
            "name": "Паста",
            "price": 700,
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Паста"


@pytest.mark.asyncio
async def test_admin_create_item_invalid_category(client, admin_token):
    r = await client.post(
        "/api/v1/menu/admin/menu/items",
        json={"category_id": 999, "name": "X", "price": 1, "is_active": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_admin_update_item(client, menu_fixtures, admin_token):
    cat, item = menu_fixtures
    r = await client.patch(
        f"/api/v1/menu/admin/menu/items/{item.id}",
        json={"price": 2000, "is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["price"] == 2000
    assert r.json()["is_active"] is False


@pytest.mark.asyncio
async def test_admin_delete_item(client, menu_fixtures, admin_token):
    _, item = menu_fixtures
    r = await client.delete(
        f"/api/v1/menu/admin/menu/items/{item.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_admin_delete_category_with_items_fails(
    client, menu_fixtures, admin_token
):
    cat, _ = menu_fixtures
    r = await client.delete(
        f"/api/v1/menu/admin/menu/categories/{cat.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_admin_delete_empty_category_succeeds(client, admin_token):
    create = await client.post(
        "/api/v1/menu/admin/menu/categories",
        json={"name": "Пустая", "description": "", "sort_order": 99},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create.status_code == 201
    cat_id = create.json()["id"]

    r = await client.delete(
        f"/api/v1/menu/admin/menu/categories/{cat_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_menu_admin_forbidden_for_client(client, client_token):
    r = await client.post(
        "/api/v1/menu/admin/menu/categories",
        json={"name": "X", "description": "", "sort_order": 0},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 403