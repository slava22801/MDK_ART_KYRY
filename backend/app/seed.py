"""Idempotent seed script.

Запуск:
    docker compose --profile seed run --rm seed
    # или локально:
    cd backend && python -m app.seed
"""
import asyncio
import logging

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.menu import MenuCategory, MenuItem
from app.models.table import Table
from app.models.user import User, UserRole

logger = logging.getLogger("art_kyry.seed")


async def seed_admin(session) -> User:
    email = settings.seed_admin_email.lower()
    existing = await session.scalar(select(User).where(User.email == email))
    if existing is not None:
        logger.info("admin already exists: %s", email)
        return existing
    admin = User(
        email=email,
        password_hash=hash_password(settings.seed_admin_password),
        name=settings.seed_admin_name,
        role=UserRole.ADMIN,
    )
    session.add(admin)
    await session.commit()
    await session.refresh(admin)
    logger.info("created admin: %s", email)
    return admin


async def seed_test_client(session) -> User | None:
    email = settings.seed_test_client_email.lower()
    existing = await session.scalar(select(User).where(User.email == email))
    if existing is not None:
        logger.info("test client already exists: %s", email)
        return existing
    client = User(
        email=email,
        password_hash=hash_password(settings.seed_test_client_password),
        name="Тестовый клиент",
        phone="+7 999 000-00-00",
    )
    session.add(client)
    await session.commit()
    await session.refresh(client)
    logger.info("created test client: %s", email)
    return client


TABLES_SEED = [
    ("1", 2),
    ("2", 2),
    ("3", 4),
    ("4", 4),
    ("5", 6),
    ("6", 6),
    ("7", 8),
    ("VIP-1", 10),
]


async def seed_tables(session) -> int:
    created = 0
    for number, capacity in TABLES_SEED:
        existing = await session.scalar(select(Table).where(Table.number == number))
        if existing is not None:
            continue
        session.add(Table(number=number, capacity=capacity, is_active=True))
        created += 1
    if created:
        await session.commit()
    logger.info("seeded tables: %d new, %d existed", created, len(TABLES_SEED) - created)
    return created


MENU_SEED: list[tuple[str, str | None, int, list[tuple[str, str | None, int]]]] = [
    (
        "Горячее",
        "Основные блюда",
        10,
        [
            ("Стейк Рибай", "Прожарка medium, 300 г", 1890),
            ("Паста Карбонара", "Спагетти, бекон, пармезан", 690),
            ("Лосось на гриле", "Филе лосося с овощами", 1290),
            ("Куриное филе", "С картофельным пюре", 590),
        ],
    ),
    (
        "Салаты",
        "Свежие салаты",
        20,
        [
            ("Цезарь с курицей", "С пармезаном и соусом", 490),
            ("Греческий", "Фета, томаты, оливки", 450),
            ("Тёплый салат с телятиной", "Микс салатов и телятина", 620),
        ],
    ),
    (
        "Напитки",
        "Безалкогольные",
        30,
        [
            ("Эспрессо", "30 мл", 180),
            ("Капучино", "200 мл", 280),
            ("Чай (чайник)", "500 мл", 350),
            ("Лимонад домашний", "500 мл", 320),
        ],
    ),
    (
        "Десерты",
        "Сладкое",
        40,
        [
            ("Тирамису", "Классический итальянский", 490),
            ("Чизкейк Нью-Йорк", "С ягодным соусом", 450),
        ],
    ),
]


async def seed_menu(session) -> tuple[int, int]:
    cats_created = 0
    items_created = 0
    for cat_name, cat_desc, sort_order, items in MENU_SEED:
        category = await session.scalar(
            select(MenuCategory).where(MenuCategory.name == cat_name)
        )
        if category is None:
            category = MenuCategory(
                name=cat_name, description=cat_desc, sort_order=sort_order
            )
            session.add(category)
            await session.commit()
            await session.refresh(category)
            cats_created += 1

        for item_name, item_desc, price in items:
            existing = await session.scalar(
                select(MenuItem).where(
                    MenuItem.category_id == category.id, MenuItem.name == item_name
                )
            )
            if existing is not None:
                continue
            session.add(
                MenuItem(
                    category_id=category.id,
                    name=item_name,
                    description=item_desc,
                    price=price,
                    is_active=True,
                )
            )
            items_created += 1

    if items_created:
        await session.commit()
    logger.info(
        "seeded menu: %d new categories, %d new items", cats_created, items_created
    )
    return cats_created, items_created


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    async with SessionLocal() as session:
        await seed_admin(session)
        await seed_test_client(session)
        await seed_tables(session)
        await seed_menu(session)
    logger.info("seed complete")


if __name__ == "__main__":
    asyncio.run(main())