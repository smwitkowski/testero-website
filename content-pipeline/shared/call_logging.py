"""Metadata-only model call accounting; never retain prompts or provider bodies."""
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
import json
from pathlib import Path
from threading import Lock
import time

_CONTEXT = ContextVar("model_call_context", default={})
_LOCK = Lock()
TOKEN_FIELDS = ("input_tokens", "output_tokens", "cached_input_tokens",
                "cache_creation_input_tokens", "reasoning_tokens")


@contextmanager
def call_context(*, stage=None, candidate_id=None, index=None, attempt=None, calls_path=None, escalation=None, verify_context=None):
    """Inherit unspecified metadata; threads must enter their own context."""
    values = dict(_CONTEXT.get())
    values.update({k: v for k, v in locals().copy().items()
                   if k in ("stage", "candidate_id", "index", "attempt", "calls_path", "escalation", "verify_context") and v is not None})
    token = _CONTEXT.set(values)
    try:
        yield
    finally:
        _CONTEXT.reset(token)


def _count(value):
    return value if type(value) is int and value >= 0 else None


def usage_fields(usage, *, provider):
    """Normalize only explicit provider counts; absent counts remain unknown."""
    usage = usage if isinstance(usage, dict) else {}
    result = dict.fromkeys(TOKEN_FIELDS)
    if provider in ("claude", "codex"):
        result.update({name: _count(usage.get(name)) for name in TOKEN_FIELDS})
        if provider == "claude":
            result["cached_input_tokens"] = _count(usage.get("cache_read_input_tokens"))
        else:
            result["reasoning_tokens"] = _count(usage.get("reasoning_output_tokens"))
    else:
        result["input_tokens"] = _count(usage.get("prompt_tokens"))
        result["output_tokens"] = _count(usage.get("completion_tokens"))
        details = usage.get("prompt_tokens_details") or {}
        output_details = usage.get("completion_tokens_details") or {}
        if isinstance(details, dict):
            result["cached_input_tokens"] = _count(details.get("cached_tokens"))
        if isinstance(output_details, dict):
            result["reasoning_tokens"] = _count(output_details.get("reasoning_tokens"))
    return result


def cli_usage(text, *, provider):
    """Codex turn.completed usage is independent of its final -o payload."""
    try:
        if provider == "claude":
            envelope = json.loads(text)
            return usage_fields(envelope.get("usage"), provider=provider)
        turns = [json.loads(line) for line in text.splitlines() if line.strip()]
        usages = [row["usage"] for row in turns if isinstance(row, dict)
                  and row.get("type") == "turn.completed" and isinstance(row.get("usage"), dict)]
        if usages:
            normalized = [usage_fields(value, provider=provider) for value in usages]
            return {key: sum(row[key] for row in normalized)
                    if all(row[key] is not None for row in normalized) else None for key in TOKEN_FIELDS}
    except (ValueError, TypeError, AttributeError):
        pass
    return dict.fromkeys(TOKEN_FIELDS)


@contextmanager
def model_call(model, *, provider=None):
    """Record one transport attempt, including exceptions, when a sink is set."""
    context = dict(_CONTEXT.get())
    path = context.pop("calls_path", None)
    usage = dict.fromkeys(TOKEN_FIELDS)
    started = time.monotonic()
    error_class = None
    try:
        yield usage
    except BaseException as error:
        error_class = type(error).__name__
        raise
    finally:
        if path is not None:
            record = {"ts": datetime.now(timezone.utc).isoformat(),
                      **{key: context.get(key) for key in ("stage", "candidate_id", "index", "attempt", "escalation", "verify_context")},
                      "model": model, **({"provider": provider} if provider else {}),
                      **{key: _count(usage.get(key)) for key in TOKEN_FIELDS},
                      "seconds": time.monotonic() - started,
                      "ok": error_class is None, "error_class": error_class,
                      **{key: usage[key] for key in ("budget_call_id", "cost_usd", "cost_kind") if key in usage}}
            with _LOCK:
                destination = Path(path)
                destination.parent.mkdir(parents=True, exist_ok=True)
                with destination.open("a", encoding="utf-8") as handle:
                    handle.write(json.dumps(record, allow_nan=False) + "\n")


@contextmanager
def log_lm_calls(lm, model):
    """Wrap DSPy forward calls and observe usage before parsing/truncation."""
    original_forward = lm.forward
    original_check = getattr(lm, "_check_truncation", None)
    had_forward = "forward" in lm.__dict__
    had_check = "_check_truncation" in lm.__dict__
    active = None
    original_retries = getattr(lm, "num_retries", None)

    def check(response):
        if active is not None:
            usage = response.get("usage") if isinstance(response, dict) else getattr(response, "usage", None)
            if hasattr(usage, "model_dump"):
                usage = usage.model_dump()
            active.update(usage_fields(usage, provider="openrouter"))
        return original_check(response)

    def forward(*args, **kwargs):
        nonlocal active
        from shared.nightly_budget import reserve_model, enabled
        reservation = reserve_model(model, args, kwargs, lm, stage=_CONTEXT.get().get("stage")) if enabled() else None
        with model_call(model) as usage:
            if reservation is not None:
                usage.update({key: reservation[key] for key in ("budget_call_id", "cost_usd", "cost_kind")})
            active = usage
            try:
                return original_forward(*args, **kwargs)
            finally:
                active = None

    lm.forward = forward
    if callable(original_check):
        lm._check_truncation = check
    try:
        yield
    finally:
        if original_retries is not None:
            lm.num_retries = original_retries
        if had_forward:
            lm.forward = original_forward
        else:
            del lm.forward
        if callable(original_check):
            if had_check:
                lm._check_truncation = original_check
            else:
                del lm._check_truncation
