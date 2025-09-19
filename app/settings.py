from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    orch_api_key: str = Field(default="secret", alias="ORCH_API_KEY")
    plan_max_diff_lines: int = Field(default=20, alias="PLAN_MAX_DIFF_LINES")

    default_timezone: str = Field(default="America/New_York", alias="DEFAULT_TIMEZONE")
    policy_qh_start: str = Field(default="21:00", alias="POLICY_QH_START")
    policy_qh_end: str = Field(default="08:00", alias="POLICY_QH_END")
    policy_weekly_cap: int = Field(default=3, alias="POLICY_WEEKLY_CAP")
    policy_kill_switch: bool = Field(default=False, alias="POLICY_KILL_SWITCH")
    policy_blocklist: str = Field(default="", alias="POLICY_BLOCKLIST")


settings = Settings()
