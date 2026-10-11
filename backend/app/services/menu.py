from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.menu import MenuCategory, MenuItem
from app.schemas.menu import (
    MenuCategoryCreate,
    MenuCategoryUpdate,
    MenuItemCreate,
    MenuItemUpdate,
)


async def list_categories_with_items(
    session: AsyncSession, only_active_items: bool = True
) -> list[MenuCategory]:
    stmt = (
        select(MenuCategory)
        .options(selectinload(MenuCategory.items))
        .order_by(MenuCategory.sort_order, MenuCategory.name)
    )
    result = await session.scalars(stmt)
    categories = list(result)
    if only_active_items:
        for cat in categories:
            cat.items = [it for it in cat.items if it.is_active]
    return categories


async def get_category(session: AsyncSession, category_id: int) -> MenuCategory | None:
    return await session.get(MenuCategory, category_id)


async def get_item(session: AsyncSession, item_id: int) -> MenuItem | None:
    return await session.get(MenuItem, item_id)


async def create_category(
    session: AsyncSession, payload: MenuCategoryCreate
) -> MenuCategory:
    cat = MenuCategory(**payload.model_dump())
    session.add(cat)
    await session.commit()
    await session.refresh(cat)
    return cat


async def update_category(
    session: AsyncSession, cat: MenuCategory, payload: MenuCategoryUpdate
) -> MenuCategory:
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    await session.commit()
    await session.refresh(cat)
    return cat


async def delete_category(session: AsyncSession, cat: MenuCategory) -> None:
    await session.delete(cat)
    await session.commit()


async def create_item(session: AsyncSession, payload: MenuItemCreate) -> MenuItem:
    item = MenuItem(**payload.model_dump())
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def update_item(
    session: AsyncSession, item: MenuItem, payload: MenuItemUpdate
) -> MenuItem:
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await session.commit()
    await session.refresh(item)
    return item


async def delete_item(session: AsyncSession, item: MenuItem) -> None:
    await session.delete(item)
    await session.commit()