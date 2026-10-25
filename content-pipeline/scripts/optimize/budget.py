"""Conservative, durable local admission for every model transport attempt.

Prices are coordinator-approved USD per million tokens, including nonzero
subscription-quota valuations. Reservations are retained after any outcome.
They are upper-bound estimates, not provider invoices.
"""
from __future__ import annotations

from contextlib import contextmanager
from decimal import Decimal, InvalidOperation
import fcntl
import json
from pathlib import Path
from threading import RLock
from unittest.mock import patch


class BudgetExceeded(BaseException):
    """Stop the run without being swallowed by production retry/error handlers."""


class MetricLimitExceeded(BaseException):
    """Stop before admitting a metric beyond the configured call limit."""


def positive_money(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("Budget and prices must be finite positive numbers") from None
    if not result.is_finite() or result <= 0:
        raise ValueError("Budget and prices must be finite positive numbers")
    return result


def input_token_bound(prompt=None, messages=None):
    """Bound text-only tokenization by UTF-8 bytes plus framing allowance."""
    if messages is not None:
        if not isinstance(messages, list) or any(
            not isinstance(row, dict) or set(row) - {"role", "content"}
            or not isinstance(row.get("role"), str)
            or not isinstance(row.get("content"), str) for row in messages
        ):
            raise ValueError("Only text-only model messages can be budgeted")
        text = json.dumps(messages, ensure_ascii=False)
    elif isinstance(prompt, str):
        text = prompt
    else:
        raise ValueError("Cannot bound model input")
    return len(text.encode("utf-8")) + 4096


class SpendBudget:
    """File-locked reservations shared by calls, threads, and resumed processes."""

    def __init__(self, cap_usd, prices, ledger_path):
        self.cap = positive_money(cap_usd)
        if not isinstance(prices, dict) or not prices:
            raise ValueError("Explicit nonzero upper-bound model prices are required")
        self.prices = {}
        for model, rate in prices.items():
            if not isinstance(model, str) or not model or not isinstance(rate, dict):
                raise ValueError("Invalid model prices")
            self.prices[model] = {
                key: positive_money(rate.get(key))
                for key in ("input_usd_per_million", "output_usd_per_million")
            }
        self.path = Path(ledger_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = RLock()

    def _records(self):
        if not self.path.exists():
            return []
        # Corruption is an error, never a reset to zero spending.
        return [json.loads(line) for line in self.path.read_text().splitlines() if line.strip()]

    def reserve(self, model, input_tokens, output_tokens):
        if any(type(n) is not int or n <= 0 for n in (input_tokens, output_tokens)):
            raise ValueError("Positive token bounds are required")
        if model not in self.prices:
            raise ValueError("Missing upper-bound prices for model " + model)
        rate = self.prices[model]
        cost = (input_tokens * rate["input_usd_per_million"]
                + output_tokens * rate["output_usd_per_million"]) / Decimal(1_000_000)
        with self.lock, self.path.with_suffix(self.path.suffix + ".lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            used = sum((positive_money(row["reserved_usd"]) for row in self._records()), Decimal(0))
            if used + cost > self.cap:
                raise BudgetExceeded("Local spend estimate cap reached")
            row = {"model": model, "input_token_bound": input_tokens,
                   "output_token_bound": output_tokens, "reserved_usd": str(cost)}
            with self.path.open("a") as sink:
                sink.write(json.dumps(row) + "\n")
                sink.flush()
                import os
                os.fsync(sink.fileno())
            return row

    def snapshot(self):
        with self.lock:
            rows = self._records()
            used = sum((positive_money(row["reserved_usd"]) for row in rows), Decimal(0))
            return {"cap_usd": str(self.cap), "reserved_usd": str(used),
                    "remaining_usd": str(self.cap - used), "transport_attempts": len(rows),
                    "cost_kind": "conservative_reservations_not_invoices"}


class MetricLimiter:
    def __init__(self, metric, limit, *, cache=False):
        if type(limit) is not int or limit < 1:
            raise ValueError("Metric call limit must be positive")
        self.metric, self.limit, self.calls = metric, limit, 0
        self.scores = []
        self.cache_enabled, self.cache_hits = cache, 0
        self._cache = {}
        self.lock = RLock()

    @staticmethod
    def _key(gold, pred):
        import hashlib
        def encode(value):
            if hasattr(value, "toDict"):
                return value.toDict()
            if hasattr(value, "model_dump"):
                return value.model_dump(mode="json")
            raise TypeError("Metric inputs must be JSON-safe")
        data = json.dumps([gold, pred], default=encode, sort_keys=True,
                          ensure_ascii=False, allow_nan=False)
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    def __call__(self, gold, pred, trace=None, pred_name=None, pred_trace=None):
        # These writer-stage metrics depend only on gold/candidate data, not
        # trace or predictor names. GEPA asks again for reflection feedback;
        # reuse the exact scored verdict instead of paying the judge twice.
        from copy import deepcopy
        key = self._key(gold, pred) if self.cache_enabled else None
        with self.lock:
            if key is not None and key in self._cache:
                self.cache_hits += 1
                return deepcopy(self._cache[key])
            if self.calls >= self.limit:
                raise MetricLimitExceeded("Metric call cap reached")
            self.calls += 1
            result = self.metric(gold, pred, trace, pred_name, pred_trace)
            score = getattr(result, "score", result)
            if type(score) in (int, float):
                import math
                if math.isfinite(score):
                    self.scores.append(float(score))
            if key is not None:
                self._cache[key] = deepcopy(result)
            return result


@contextmanager
def budgeted_calls(budget, *, cli_output_tokens=131072):
    """Reserve before all DSPy and subscription transport attempts in this process.

    This process-scoped guard is for single optimizer/evaluator CLI runs, not a
    web server. CLI output is a configured upper-bound estimate because the
    existing subscription transport exposes no enforceable max-token flag.
    """
    import dspy
    from shared import cli_models
    if type(cli_output_tokens) is not int or cli_output_tokens <= 0:
        raise ValueError("CLI output token bound must be positive")
    original_lm = dspy.LM.forward
    original_cli = cli_models._run_cli_transport

    def lm_forward(lm, *args, **kwargs):
        if args:
            raise ValueError("Positional model arguments cannot be budgeted")
        count = kwargs.get("n", lm.kwargs.get("n", 1))
        if count != 1:
            raise ValueError("Only one completion per budgeted request is allowed")
        output = kwargs.get("max_tokens", lm.kwargs.get("max_tokens"))
        budget.reserve(lm.model, input_token_bound(kwargs.get("prompt"), kwargs.get("messages")), output)
        # Every provider attempt must be visible to this guard. Disable opaque retries.
        lm.num_retries = 0
        lm.cache = False
        return original_lm(lm, **kwargs)

    def cli_transport(model, prompt, schema, signature, **kwargs):
        budget.reserve(model, input_token_bound(prompt), cli_output_tokens)
        return original_cli(model, prompt, schema, signature, **kwargs)

    with patch.object(dspy.LM, "forward", lm_forward), patch.object(cli_models, "_run_cli_transport", cli_transport):
        yield budget


@contextmanager
def serial_dspy_execution():
    """Run optimizer evaluation inline so a cap cannot leave queued model calls.

    DSPy 3.0.4's ParallelExecutor uses shutdown(wait=False), even with one
    thread. A BaseException cap can otherwise escape while queued work is
    still alive and outlast the transport guard. This process-scoped CLI-only
    override preserves failure accounting without creating a worker pool.
    """
    from dspy.utils.parallelizer import ParallelExecutor

    def execute(executor, function, data):
        wrapped = executor._wrap_function(function)
        results = []
        for index, item in enumerate(data):
            outcome = wrapped(item)
            if isinstance(outcome, Exception):
                executor.failed_indices.append(index)
                executor.exceptions_map[index] = outcome
                results.append(None)
            else:
                results.append(outcome)
            if executor.cancel_jobs.is_set():
                raise RuntimeError("Serial DSPy execution cancelled after errors")
        return results

    with patch.object(ParallelExecutor, "execute", execute):
        yield
