from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.policy.models import Policies
from app.policy.timeutils import in_quiet_hours


class Suppression:
    def __init__(self, suppressed: bool, reason: Optional[str] = None) -> None:
        self.suppressed = suppressed
        self.reason = reason


def normalize_identity(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    return email.strip().lower() or None


def blocked_by_list(email: Optional[str], blocklist: list[str]) -> bool:
    if not email:
        return False
    em = normalize_identity(email)
    if not em:
        return False
    for entry in blocklist:
        normalized = entry.strip().lower()
        if not normalized:
            continue
        if normalized.startswith("@"):
            domain = em.split("@")[-1]
            if domain == normalized[1:]:
                return True
        elif em == normalized:
            return True
    return False


def enforce_policies(
    p: Policies,
    *,
    recipient_email: Optional[str] = None,
    weekly_count: Optional[int] = None,
    now: Optional[datetime] = None,
) -> Suppression:
    if p.kill_switch:
        return Suppression(True, "kill_switch_enabled")

    if blocked_by_list(recipient_email, p.blocklist):
        return Suppression(True, "recipient_blocklisted")

    if p.quiet_hours:
        current = now or datetime.now(timezone.utc)
        if in_quiet_hours(
            current, p.quiet_hours.start, p.quiet_hours.end, p.quiet_hours.timezone
        ):
            return Suppression(True, "quiet_hours")

    if p.caps is not None and weekly_count is not None:
        if weekly_count >= p.caps.per_user_weekly_marketing:
            return Suppression(True, "weekly_cap_exceeded")

    return Suppression(False, None)
