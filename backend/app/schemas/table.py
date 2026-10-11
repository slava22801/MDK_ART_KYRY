from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TableBase(BaseModel):
    number: str = Field(min_length=1, max_length=16)
    capacity: int = Field(ge=1, le=50)
    is_active: bool = True


class TableCreate(TableBase):
    pass


class TableUpdate(BaseModel):
    number: str | None = Field(default=None, min_length=1, max_length=16)
    capacity: int | None = Field(default=None, ge=1, le=50)
    is_active: bool | None = None


class TableRead(TableBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class AvailabilityQuery(BaseModel):
    start_time: datetime  # noqa: F821
    guests_count: int = Field(ge=1, le=50)