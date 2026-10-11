import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.reservations import cancel_expired_pending

logger = logging.getLogger("art_kyry.scheduler")
logging.basicConfig(level=logging.INFO)


async def _expire_job() -> None:
    async with SessionLocal() as session:
        try:
            n = await cancel_expired_pending(session)
            if n:
                logger.info("expired %d pending reservations", n)
        except Exception as exc:  # pragma: no cover
            logger.exception("expire job failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        _expire_job,
        trigger="interval",
        seconds=30,
        id="cancel_expired_pending",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    app.state.scheduler = scheduler
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="Арт-Кыры Restaurant API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix="/api/v1")