from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.reservation import ReservationStatus


class ReservationCreate(BaseModel):
    table_id: int
    start_time: datetime
    guests_count: int = Field(ge=1, le=50)


class ReservationRead(BaseModel):
    id: int
    user_id: int
    table_id: int
    start_time: datetime
    end_time: datetime
    guests_count: int
    status: ReservationStatus
    deposit_amount: int
    payment_id: str | None
    payment_provider: str | None
    hold_expires_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReservationWithPayment(ReservationRead):
    payment_url: str | None = None


class ReservationShort(BaseModel):
    id: int
    table_id: int
    start_time: datetime
    end_time: datetime
    guests_count: int
    status: ReservationStatus

    model_config = ConfigDict(from_attributes=True)


class AdminReservationUpdate(BaseModel):
    status: ReservationStatus | None = None