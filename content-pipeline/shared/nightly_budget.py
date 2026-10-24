"""Opt-in conservative reservations for nightly paid calls; no credentials stored.

Reservations are durable maximum charges, not refunds or measured invoices.
The coordinator must approve upper-bound prices in the nightly configuration.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import uuid

from scripts.nightly_budget import accounting, money, check_reserve, load_calls, BudgetError


def enabled():
    return bool(os.environ.get("TESTERO_NIGHTLY_CONFIG"))


def configuration():
    path = os.environ.get("TESTERO_NIGHTLY_CONFIG")
    if not path:
        return None
    return json.loads(Path(path).read_text())


def reserve(provider, ceiling, *, model):
    """Serialize admission and retain the full maximum charge even on failure."""
    config = configuration()
    root = Path(config["calls_root"])
    root.mkdir(parents=True, exist_ok=True)
    path = root / "nightly-budget.calls.jsonl"
    with (root / "nightly-budget.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        now = datetime.now(timezone.utc)
        report = accounting(load_calls(root), now, rates=config.get("rates"), cap_overrides=config.get("cap_overrides"))
        check_reserve(report, {"openrouter": ceiling if provider == "openrouter" else 0,
                               "exa": ceiling if provider == "exa" else 0})
        record = {"ts": now.isoformat(), "provider": provider, "model": model,
                  "budget_call_id": str(uuid.uuid4()), "cost_usd": str(ceiling),
                  "cost_kind": "maximum_reserved", "ok": None,
                  "stage": "budget_reservation", "seconds": 0}
        with path.open("a") as handle:
            handle.write(json.dumps(record) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
    return record


def reserve_model(model, args, kwargs, lm, *, stage):
    if not enabled():
        return None
    # Nightly generation is subscription-only. The only paid LM seat is Argon.
    if not model.startswith("openrouter/") or not str(stage).startswith("argon_"):
        raise BudgetError("Paid generation fallback is forbidden")
    config = configuration()
    rate = config.get("rates", {}).get(model)
    if not isinstance(rate, dict):
        raise BudgetError("Missing upper-bound model prices")
    # A UTF-8 byte bound plus framing allowance safely overestimates text tokens.
    # No images/tools/media are allowed in this paid council path.
    messages = kwargs.get("messages")
    prompt = kwargs.get("prompt")
    if messages is not None:
        if not isinstance(messages, list) or any(not isinstance(m, dict) or not isinstance(m.get("content"), str)
                                                 or set(m) - {"role", "content"} for m in messages):
            raise BudgetError("Only text-only council prompts are budgeted")
        payload = json.dumps(messages, ensure_ascii=False)
    elif isinstance(prompt, str):
        payload = prompt
    elif args and isinstance(args[0], str):
        payload = args[0]
    else:
        raise BudgetError("Cannot bound model input")
    output = kwargs.get("max_tokens", lm.kwargs.get("max_tokens"))
    if type(output) is not int or output < 1:
        raise BudgetError("Cannot bound model output")
    input_bound = len(payload.encode("utf-8")) + 4096
    ceiling = (input_bound * money(rate["input_tokens"]) + output * money(rate["output_tokens"])) / 1_000_000
    # Disable opaque LiteLLM retries: each explicit retry must reserve independently.
    lm.num_retries = 0
    return reserve("openrouter", ceiling, model=model)


@contextmanager
def exa_call(*, num_results, include_text=False):
    """Bound one SDK search by coordinator-approved request/result maxima."""
    if enabled():
        config = configuration()
        if type(num_results) is not int or num_results < 1:
            raise BudgetError("Cannot bound Exa request")
        prices = config.get("exa_upper_bound", {})
        ceiling = money(prices.get("request_usd")) + num_results * money(prices.get("result_usd"))
        if include_text:
            ceiling += num_results * money(prices.get("text_result_usd"))
        reserve("exa", ceiling, model="exa/search")
    yield


def daily_claim(root, now, *, publications=None, db_used=0):
    """Share conservative batch/publication caps across all nightly state dirs."""
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    path = root / "nightly-limits.json"
    with (root / "nightly-budget.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        ledger = json.loads(path.read_text()) if path.exists() else {}
        key = now.astimezone(timezone.utc).date().isoformat()
        day = ledger.setdefault(key, {"batches": 0, "publication_slots": 0})
        if publications is None:
            if day["batches"] >= 2:
                raise BudgetError("Two nightly batches already reserved for this UTC day")
            day["batches"] += 1
            granted = 1
        else:
            if type(publications) is not int or not 0 <= publications <= 10 or type(db_used) is not int or db_used < 0:
                raise BudgetError("Invalid daily publication count")
            granted = min(publications, max(0, 10 - max(db_used, day["publication_slots"])))
            day["publication_slots"] = max(db_used, day["publication_slots"]) + granted
        temporary = path.with_suffix(".tmp")
        with temporary.open("w") as handle:
            json.dump(ledger, handle)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    return granted
