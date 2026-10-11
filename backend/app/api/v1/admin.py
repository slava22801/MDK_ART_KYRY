from fastapi import APIRouter, Depends

from app.api.deps import get_session, require_admin
from app.models.user import User
from app.schemas.admin import DashboardStats
from app.services import admin as admin_service
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def stats(
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> DashboardStats:
    raw = await admin_service.dashboard_stats(session)
    return DashboardStats.model_validate(raw)