from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.table import Table


async def list_tables(session: AsyncSession, only_active: bool = True) -> list[Table]:
    stmt = select(Table)
    if only_active:
        stmt = stmt.where(Table.is_active.is_(True))
    stmt = stmt.order_by(Table.number)
    result = await session.scalars(stmt)
    return list(result)


async def get_table(session: AsyncSession, table_id: int) -> Table | None:
    return await session.get(Table, table_id)


async def create_table(session: AsyncSession, number: str, capacity: int, is_active: bool) -> Table:
    table = Table(number=number, capacity=capacity, is_active=is_active)
    session.add(table)
    await session.commit()
    await session.refresh(table)
    return table


async def update_table(
    session: AsyncSession,
    table: Table,
    number: str | None,
    capacity: int | None,
    is_active: bool | None,
) -> Table:
    if number is not None:
        table.number = number
    if capacity is not None:
        table.capacity = capacity
    if is_active is not None:
        table.is_active = is_active
    await session.commit()
    await session.refresh(table)
    return table


async def delete_table(session: AsyncSession, table: Table) -> None:
    await session.delete(table)
    await session.commit()