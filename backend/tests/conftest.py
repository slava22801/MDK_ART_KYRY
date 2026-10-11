"""Общие фикстуры для интеграционных тестов.

Требования:
  - Запущенный PostgreSQL с правами на CREATE EXTENSION btree_gist
  - Переменная TEST_DATABASE_URL вида postgresql+asyncpg://user:pass@host:5432/test_db

Каждый тест:
  1. Берёт engine, сессию и HTTP-клиент из пула сессионных фикстур
  2. TRUNCATE таблиц перед каждым тестом
  3. Запускает тело теста

Тесты НЕ используют lifespan (httpx ASGITransport не триггерит события lifespan),
поэтому APScheduler в app.main НЕ запускается в тестах.

Event loop — session-scoped, чтобы избежать проблем asyncpg с разными loop'ами
между тестами.
"""
import asyncio
import os
import sys

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# На Windows используем SelectorEventLoop
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@pytest.fixture(scope="session")
def event_loop():
    """Один event loop на всю сессию тестов (иначе asyncpg connections ломаются
    при переходе между loop'ами)."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://art_kyry:art_kyry_pass@localhost:5432/art_kyry_test",
    ),
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET", "test_secret_long_enough_for_jwt_signing_yes_yes")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_ACCESS_TTL_MIN", "60")
os.environ.setdefault("S3_ENDPOINT", "http://localhost:9000")
os.environ.setdefault("S3_ACCESS_KEY", "test")
os.environ.setdefault("S3_SECRET_KEY", "test")
os.environ.setdefault("S3_BUCKET", "art-kyry-test")
os.environ.setdefault("S3_REGION", "us-east-1")
os.environ.setdefault("PAYMENT_PROVIDER", "stub")
os.environ.setdefault("PAYMENT_WEBHOOK_SECRET", "test_webhook_secret")
os.environ.setdefault("DEPOSIT_AMOUNT", "500")
os.environ.setdefault("RESERVATION_HOLD_MIN", "15")
os.environ.setdefault("RESERVATION_DEFAULT_DURATION_MIN", "120")
os.environ.setdefault("FRONTEND_BASE_URL", "http://test")

from app.core.config import settings  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_session  # noqa: E402
import app.models  # noqa: E402,F401  -- register models on Base.metadata
from app.main import app  # noqa: E402
from app.models.menu import MenuCategory, MenuItem  # noqa: E402
from app.models.table import Table  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

TRUNCATE_SQL = text(
    "TRUNCATE reservations, tables, menu_items, menu_categories, users "
    "RESTART IDENTITY CASCADE"
)


def _has_test_db() -> bool:
    return "TEST_DATABASE_URL" in os.environ or "DATABASE_URL" in os.environ


pytestmark = pytest.mark.skipif(
    not _has_test_db(),
    reason="TEST_DATABASE_URL or DATABASE_URL not set",
)


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def engine():
    """Session-scoped engine с NullPool: одна схема на всю сессию тестов.
    Перед каждым тестом — TRUNCATE через autouse-фикстуру."""
    from sqlalchemy.pool import NullPool

    eng = create_async_engine(
        settings.database_url, echo=False, future=True, poolclass=NullPool
    )
    async with eng.connect() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                """
                ALTER TABLE reservations
                ADD CONSTRAINT ex_reservations_no_overlap
                EXCLUDE USING gist (
                    table_id WITH =,
                    time_range WITH &&
                ) WHERE (status IN ('pending_payment', 'confirmed'))
                """
            )
        )
        await conn.commit()
    yield eng
    async with eng.connect() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.commit()
    await eng.dispose()


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def _truncate(engine):
    """Очистка таблиц перед каждым тестом."""
    async with engine.connect() as conn:
        await conn.execute(TRUNCATE_SQL)
        await conn.commit()
    yield


@pytest_asyncio.fixture(loop_scope="session")
def session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture(loop_scope="session")
async def session(session_factory):
    async with session_factory() as s:
        yield s


@pytest_asyncio.fixture(loop_scope="session")
async def client(session_factory):
    """HTTP-клиент поверх ASGI-приложения с подменой get_session."""

    async def override_get_session():
        async with session_factory() as s:
            try:
                yield s
            finally:
                await s.close()

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


@pytest_asyncio.fixture
async def admin_user(session) -> User:
    user = User(
        email="admin@art-kyry-test.com",
        password_hash=hash_password("admin_pass"),
        name="Test Admin",
        role=UserRole.ADMIN,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest_asyncio.fixture
async def client_user(session) -> User:
    user = User(
        email="client@art-kyry-test.com",
        password_hash=hash_password("client_pass"),
        name="Test Client",
        phone="+7 999 000-00-00",
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest_asyncio.fixture
async def second_client(session) -> User:
    user = User(
        email="client2@art-kyry-test.com",
        password_hash=hash_password("client_pass"),
        name="Second Client",
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user) -> str:
    return create_access_token(admin_user.id, extra={"role": admin_user.role.value})


@pytest.fixture
def client_token(client_user) -> str:
    return create_access_token(client_user.id, extra={"role": client_user.role.value})


@pytest.fixture
def second_client_token(second_client) -> str:
    return create_access_token(second_client.id, extra={"role": second_client.role.value})


@pytest.fixture
def signed_webhook():
    """Хелпер для вызова /webhooks/payment с валидной HMAC-подписью.

    Тело сериализуется один раз и отправляется как есть (content=), чтобы подпись
    считалась ровно по тем байтам, которые ушли на сервер.
    """
    import json as _json

    from app.services.payment_base import compute_webhook_signature

    def _send(client, payload: dict, secret: str | None = None):
        body = _json.dumps(payload, separators=(",", ":")).encode("utf-8")
        signature = compute_webhook_signature(
            body, secret or os.environ["PAYMENT_WEBHOOK_SECRET"]
        )
        return client.post(
            "/api/v1/webhooks/payment",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Signature": signature,
            },
        )

    return _send


@pytest_asyncio.fixture
async def three_tables(session) -> list[Table]:
    """3 стола с разной вместимостью."""
    rows = [
        Table(number="A1", capacity=2, is_active=True),
        Table(number="A2", capacity=4, is_active=True),
        Table(number="A3", capacity=6, is_active=True),
        Table(number="OFF", capacity=10, is_active=False),
    ]
    session.add_all(rows)
    await session.commit()
    for r in rows:
        await session.refresh(r)
    return rows


@pytest_asyncio.fixture
async def menu_fixtures(session) -> tuple[MenuCategory, MenuItem]:
    cat = MenuCategory(name="Горячее", description="", sort_order=10)
    session.add(cat)
    await session.commit()
    await session.refresh(cat)
    item = MenuItem(
        category_id=cat.id, name="Стейк", description="300 г", price=1500, is_active=True
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return cat, item