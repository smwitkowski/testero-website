"""Fail closed on provider token limits without retaining transport or history."""

from contextlib import contextmanager
from collections.abc import Mapping

import dspy
from openai import LengthFinishReasonError

TRUNCATION_REASON = "LM completion reached its token limit"


class MaxTokensTruncation(ValueError):
    """A completion stopped at its output token limit, even if it parses."""

    def __init__(self, diagnostics=None):
        super().__init__(TRUNCATION_REASON)
        self.error_class = "MaxTokensTruncation"
        self.diagnostics = diagnostics
        self.raw_response = (diagnostics or {}).get("raw_response")


def _field(value, name, default=None):
    return value.get(name, default) if isinstance(value, Mapping) else getattr(value, name, default)


def _is_token_limit(reason):
    return isinstance(reason, str) and reason.casefold() in ("length", "max_tokens")


def _is_truncated(response):
    # DSPy 3 LM._check_truncation sees native LiteLLM/OpenRouter choices before
    # _process_completion discards their finish reasons. Detection reads no text.
    return any(
        _is_token_limit(_field(choice, "finish_reason"))
        or _is_token_limit(_field(choice, "native_finish_reason"))
        for choice in _field(response, "choices", ()) or ()
    )


def _typed_truncation(error):
    # Do not classify from str(error): provider bodies can contain credentials.
    for _ in range(8):
        if isinstance(error, (MaxTokensTruncation, LengthFinishReasonError)):
            return True
        error = error.__cause__ or error.__context__
        if error is None:
            break
    return False


@contextmanager
def reject_token_limit(lm, *, capture=None):
    """Reject token limits; optionally retain safe failure completion diagnostics."""
    truncated = False
    original = getattr(lm, "_check_truncation", None)
    # Production LMs are per-call instances. Restore the instance after use;
    # no history inspection, transport storage, or global DSPy mutation occurs.
    had_override = "_check_truncation" in getattr(lm, "__dict__", {})

    def check(response):
        nonlocal truncated
        response_truncated = _is_truncated(response)
        truncated = truncated or response_truncated
        if capture is not None:
            capture.observe_native(response)
            if response_truncated:
                capture.observe_truncated_completion(response)
        try:
            original(response)
        except Exception as error:
            if capture is not None and _typed_truncation(error):
                capture.observe_truncated_completion(response)
            raise

    if callable(original):
        lm._check_truncation = check
    try:
        try:
            yield
        except Exception as error:
            if truncated or _typed_truncation(error):
                raise MaxTokensTruncation(capture.failure() if capture is not None else None) from None
            raise
        if truncated:
            raise MaxTokensTruncation(capture.failure() if capture is not None else None)
    finally:
        if callable(original):
            if had_override:
                lm._check_truncation = original
            else:
                del lm._check_truncation


class SingleCallChatAdapter(dspy.ChatAdapter):
    """Use native typed parsing without ChatAdapter's hidden JSON retry."""

    def __call__(self, lm, lm_kwargs, signature, demos, inputs):
        from dspy.adapters.base import Adapter
        return Adapter.__call__(self, lm, lm_kwargs, signature, demos, inputs)
