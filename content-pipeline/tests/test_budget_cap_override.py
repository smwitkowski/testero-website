from datetime import datetime, timezone
from decimal import Decimal

import pytest

from scripts.nightly_budget import BudgetError, accounting, effective_caps

NOW = datetime(2026, 10, 24, 23, 0, tzinfo=timezone.utc)  # Saturday; week ends Mon Oct 26 00:00 UTC
ROW = {"ts": "2026-10-24T20:00:00+00:00", "provider": "openrouter", "model": "openrouter/google/gemini-4-argon",
       "stage": "argon_review", "cost_usd": "12", "seconds": 1}


def test_default_caps_unchanged():
    assert effective_caps(NOW) == {"openrouter": Decimal("10"), "exa": Decimal("5")}
    with pytest.raises(BudgetError, match="Weekly paid cap exceeded"):
        accounting([ROW], NOW)


def test_one_time_override_applies_until_expiry():
    override = [{"provider": "openrouter", "usd": "20", "until": "2026-10-26T00:00:00Z"}]
    report = accounting([ROW], NOW, cap_overrides=override)
    assert report["caps_usd"]["openrouter"] == "20"
    assert Decimal(report["remaining_usd"]["openrouter"]) == Decimal("8")
    assert report["caps_usd"]["exa"] == "5"


def test_expired_override_reverts_to_default():
    override = [{"provider": "openrouter", "usd": "20", "until": "2026-10-24T22:00:00Z"}]
    assert effective_caps(NOW, override)["openrouter"] == Decimal("10")


@pytest.mark.parametrize("override", [
    [{"provider": "openrouter", "usd": "20", "until": "2026-11-30T00:00:00Z"}],   # beyond this week
    [{"provider": "codex", "usd": "20", "until": "2026-10-26T00:00:00Z"}],        # unknown provider
    [{"provider": "openrouter", "usd": "-1", "until": "2026-10-26T00:00:00Z"}],   # negative
    [{"provider": "openrouter", "usd": "20"}],                                    # no expiry
    [{"provider": "openrouter", "usd": "20", "until": "2026-10-26T00:00:00"}],    # naive time
])
def test_invalid_overrides_fail_closed(override):
    with pytest.raises(BudgetError):
        effective_caps(NOW, override)
