import pytest


@pytest.mark.asyncio
async def test_register_success(client):
    r = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "new@art-kyry-test.com",
            "password": "secret123",
            "name": "New User",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert "access_token" in body
    assert body["user"]["email"] == "new@art-kyry-test.com"
    assert body["user"]["role"] == "client"


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    payload = {"email": "dup@art-kyry-test.com", "password": "secret123"}
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_register_short_password(client):
    r = await client.post(
        "/api/v1/auth/register", json={"email": "x@art-kyry-test.com", "password": "123"}
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "log@art-kyry-test.com", "password": "secret123"},
    )
    r = await client.post(
        "/api/v1/auth/login", json={"email": "log@art-kyry-test.com", "password": "secret123"}
    )
    assert r.status_code == 200, r.text
    assert "access_token" in r.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "log@art-kyry-test.com", "password": "secret123"},
    )
    r = await client.post(
        "/api/v1/auth/login", json={"email": "log@art-kyry-test.com", "password": "wrong"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_current_user(client, client_token):
    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "client@art-kyry-test.com"


@pytest.mark.asyncio
async def test_me_invalid_token(client):
    r = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401