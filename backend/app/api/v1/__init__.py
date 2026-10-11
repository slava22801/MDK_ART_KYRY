from fastapi import APIRouter

from app.api.v1 import admin, auth, dev, menu, reservations, tables, webhooks

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(menu.router, prefix="/menu", tags=["menu"])
api_router.include_router(tables.router, prefix="/tables", tags=["tables"])
api_router.include_router(reservations.router, prefix="/reservations", tags=["reservations"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(dev.router, prefix="/dev", tags=["dev"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])