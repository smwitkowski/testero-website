from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo


def parse_hhmm(s: str) -> time:
    hh, mm = s.split(":")
    return time(hour=int(hh), minute=int(mm))


def in_quiet_hours(
    now_utc: datetime, start_hhmm: str, end_hhmm: str, tz_name: str
) -> bool:
    """Return True if local-time(now_utc) falls within [start, end) quiet window."""
    local = now_utc.astimezone(ZoneInfo(tz_name))
    start = parse_hhmm(start_hhmm)
    end = parse_hhmm(end_hhmm)
    t = local.time()

    if start <= end:
        return start <= t < end
    return t >= start or t < end
