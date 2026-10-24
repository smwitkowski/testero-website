"""Offline, fail-closed weekly accounting over pipeline call metadata."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path

from scripts.token_report import summarize

CAPS = {"openrouter": Decimal("10"), "exa": Decimal("5")}


class BudgetError(ValueError):
    """Accounting is incomplete or the weekly paid budget is exhausted."""


def money(value):
    if isinstance(value, bool) or value is None:
        raise BudgetError("Missing paid cost; never assume zero")
    try:
        result = Decimal(str(value))
    except InvalidOperation:
        raise BudgetError("Invalid paid cost") from None
    if not result.is_finite() or result < 0:
        raise BudgetError("Invalid paid cost")
    return result


def instant(value):
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError):
        raise BudgetError("Invalid call timestamp") from None
    if result.tzinfo is None:
        raise BudgetError("Call timestamp must include timezone")
    return result.astimezone(timezone.utc)


def week_start(now):
    now = now.astimezone(timezone.utc)
    return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def load_calls(root):
    rows = []
    for path in sorted(Path(root).rglob("*.calls.jsonl")):
        if path.is_symlink():
            raise BudgetError("Call logs cannot be symlinks")
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except ValueError:
                raise BudgetError("Malformed call accounting") from None
            if not isinstance(row, dict):
                raise BudgetError("Invalid call accounting row")
            rows.append(row)
    unique = {}
    untracked = []
    for row in rows:
        ident = row.get("budget_call_id")
        if not ident:
            untracked.append(row)
            continue
        previous = unique.get(ident)
        if previous is not None:
            if money(row.get("cost_usd")) != money(previous.get("cost_usd")):
                raise BudgetError("Changed budget reservation")
            if row.get("stage") == "budget_reservation":
                continue
        unique[ident] = row
    return untracked + list(unique.values())


def provider(row):
    name = row.get("provider")
    model = row.get("model", "")
    if name in CAPS:
        return name
    if isinstance(model, str) and model.startswith("openrouter/"):
        return "openrouter"
    if name in ("codex", "claude") or model in ("codex", "claude"):
        return None
    if isinstance(model, str) and model.startswith(("codex/", "claude/")):
        return None
    raise BudgetError("Unknown provider; paid spend cannot be inferred")


def effective_caps(now, overrides=None):
    """Weekly caps. A coordinator override applies only until its expiry, which
    must fall within the current UTC week, so a one-time raise cannot persist."""
    caps = dict(CAPS)
    for item in overrides or []:
        if not isinstance(item, dict) or set(item) != {"provider", "usd", "until"} or item["provider"] not in CAPS:
            raise BudgetError("Invalid cap override")
        until = instant(item["until"])
        if until > week_start(now) + timedelta(days=7):
            raise BudgetError("Cap override must expire within the current week")
        if now < until:
            caps[item["provider"]] = money(item["usd"])
    return caps


def accounting(rows, now, *, rates=None, cap_overrides=None):
    """Explicit USD or configured token rates; absent cost/usage blocks paid work.

    Rate entries use full model ids and input/output USD per million tokens.
    Cached/reasoning counts are subsets, never added to input/output totals.
    """
    caps = effective_caps(now, cap_overrides)
    totals = {name: Decimal(0) for name in CAPS}
    selected = []
    for row in rows:
        at = instant(row.get("ts"))
        if at > now:
            raise BudgetError("Future call timestamp")
        if at < week_start(now):
            continue
        selected.append(row)
        name = provider(row)
        if name is None:
            continue
        cost = row.get("cost_usd")
        if cost is None:
            rate = (rates or {}).get(row.get("model"))
            if name != "openrouter" or not isinstance(rate, dict):
                raise BudgetError("Paid call has missing cost")
            if any(type(row.get(key)) is not int or row[key] < 0 for key in ("input_tokens", "output_tokens")):
                raise BudgetError("Paid call has missing token usage")
            cost = sum(Decimal(row[key]) * money(rate[key]) for key in ("input_tokens", "output_tokens")) / Decimal(1_000_000)
        totals[name] += money(cost)
    report = summarize(selected, None)
    report["weekly_usd"] = {name: str(value) for name, value in totals.items()}
    report["caps_usd"] = {name: str(value) for name, value in caps.items()}
    report["remaining_usd"] = {name: str(caps[name] - value) for name, value in totals.items()}
    if any(value > caps[name] for name, value in totals.items()):
        raise BudgetError("Weekly paid cap exceeded")
    return report


def check_reserve(report, reserve):
    for name in CAPS:
        requested = money(reserve.get(name))
        if requested > money(report["remaining_usd"][name]):
            raise BudgetError("Insufficient weekly paid budget")
