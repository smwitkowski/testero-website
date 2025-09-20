from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.policy.timeutils import in_quiet_hours


def _to_utc(
    year: int, month: int, day: int, hour: int, minute: int, tz: str
) -> datetime:
    local = datetime(year, month, day, hour, minute, tzinfo=ZoneInfo(tz))
    return local.astimezone(ZoneInfo("UTC"))


def test_quiet_hours_simple_window() -> None:
    tz = "America/New_York"
    start, end = "09:00", "17:00"

    inside = _to_utc(2024, 1, 2, 12, 0, tz)
    before = _to_utc(2024, 1, 2, 8, 30, tz)
    boundary_end = _to_utc(2024, 1, 2, 17, 0, tz)

    assert in_quiet_hours(inside, start, end, tz)
    assert not in_quiet_hours(before, start, end, tz)
    assert not in_quiet_hours(boundary_end, start, end, tz)


def test_quiet_hours_wrap_midnight() -> None:
    tz = "America/New_York"
    start, end = "21:00", "08:00"

    evening = _to_utc(2024, 1, 2, 22, 0, tz)
    early_morning = _to_utc(2024, 1, 3, 7, 59, tz)
    daytime = _to_utc(2024, 1, 3, 12, 0, tz)
    boundary_start = _to_utc(2024, 1, 2, 21, 0, tz)
    boundary_end = _to_utc(2024, 1, 3, 8, 0, tz)

    assert in_quiet_hours(evening, start, end, tz)
    assert in_quiet_hours(early_morning, start, end, tz)
    assert in_quiet_hours(boundary_start, start, end, tz)
    assert not in_quiet_hours(boundary_end, start, end, tz)
    assert not in_quiet_hours(daytime, start, end, tz)
