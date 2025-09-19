from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class QuietHours(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: str = Field(..., description="HH:MM local start")
    end: str = Field(..., description="HH:MM local end")
    timezone: str = Field(..., description="IANA timezone, e.g., America/New_York")


class Caps(BaseModel):
    model_config = ConfigDict(extra="forbid")

    per_user_weekly_marketing: int = Field(..., ge=0, le=100)


class Policies(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quiet_hours: Optional[QuietHours] = None
    caps: Optional[Caps] = None
    blocklist: List[str] = Field(default_factory=list)
    kill_switch: bool = False
