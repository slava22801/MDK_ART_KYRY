from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_admin
from app.models.user import User
from app.schemas.table import TableCreate, TableRead, TableUpdate
from app.services import tables as tables_service

router = APIRouter()


@router.get("", response_model=list[TableRead])
async def list_tables(session: AsyncSession = Depends(get_session)) -> list[TableRead]:
    rows = await tables_service.list_tables(session, only_active=True)
    return [TableRead.model_validate(t) for t in rows]


@router.get("/admin/tables/all", response_model=list[TableRead])
async def admin_list_all_tables(
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> list[TableRead]:
    rows = await tables_service.list_tables(session, only_active=False)
    return [TableRead.model_validate(t) for t in rows]


@router.get("/availability", response_model=list[TableRead])
async def get_availability(
    start_time: datetime = Query(...),
    guests_count: int = Query(..., ge=1, le=50),
    session: AsyncSession = Depends(get_session),
) -> list[TableRead]:
    from app.services.reservations import get_available_tables

    rows = await get_available_tables(session, start_time, guests_count)
    return [TableRead.model_validate(t) for t in rows]


@router.post(
    "/admin/tables",
    response_model=TableRead,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_table(
    payload: TableCreate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> TableRead:
    try:
        table = await tables_service.create_table(
            session, payload.number, payload.capacity, payload.is_active
        )
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="table number already exists"
        ) from exc
    return TableRead.model_validate(table)


@router.patch("/admin/tables/{table_id}", response_model=TableRead)
async def admin_update_table(
    table_id: int,
    payload: TableUpdate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> TableRead:
    table = await tables_service.get_table(session, table_id)
    if table is None:
        raise HTTPException(status_code=404, detail="table not found")
    try:
        updated = await tables_service.update_table(
            session, table, payload.number, payload.capacity, payload.is_active
        )
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="table number already exists"
        ) from exc
    return TableRead.model_validate(updated)


@router.delete("/admin/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_table(
    table_id: int,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> None:
    table = await tables_service.get_table(session, table_id)
    if table is None:
        raise HTTPException(status_code=404, detail="table not found")
    await tables_service.delete_table(session, table)