from __future__ import annotations

from app.policy.engine import enforce_policies
from app.policy.models import Caps, Policies


def _base_policies() -> Policies:
    return Policies(
        quiet_hours=None,
        caps=Caps(per_user_weekly_marketing=3),
        blocklist=["blocked@example.com", "@blocked.com"],
        kill_switch=False,
    )


def test_blocklisted_recipient_suppressed() -> None:
    policies = _base_policies()

    result = enforce_policies(policies, recipient_email="blocked@example.com")
    assert result.suppressed
    assert result.reason == "recipient_blocklisted"

    domain_result = enforce_policies(policies, recipient_email="user@blocked.com")
    assert domain_result.suppressed
    assert domain_result.reason == "recipient_blocklisted"


def test_weekly_cap_enforced() -> None:
    policies = _base_policies()

    result = enforce_policies(
        policies, recipient_email="ok@example.com", weekly_count=3
    )
    assert result.suppressed
    assert result.reason == "weekly_cap_exceeded"


def test_not_blocked_under_cap() -> None:
    policies = _base_policies()

    result = enforce_policies(
        policies, recipient_email="ok@example.com", weekly_count=1
    )
    assert not result.suppressed
    assert result.reason is None
