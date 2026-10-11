from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class DashboardStats(BaseModel):
    today: "DayStats"
    revenue_week: int
    revenue_total: int
    upcoming_7d: int


class DayStats(BaseModel):
    confirmed: int
    pending_payment: int
    cancelled_timeout: int