"""Bounded completion diagnostics from parsing and allowlisted native metadata."""

import math
import re
from collections.abc import Mapping
from typing import Any

import dspy

MAX_RAW_RESPONSE = 20_000
FINISH_REASONS = frozenset(("stop", "length", "max_tokens", "content_filter", "error",
                            "tool_calls", "function_call", "end_turn", "eos", "safety",
                            "recitation", "other", "blocklist", "prohibited_content",
                            "spii", "malformed_function_call", "stop_sequence"))
USAGE_FIELDS = ("prompt_tokens", "completion_tokens", "total_tokens", "input_tokens", "output_tokens")


def _field(value, name, default=None):
    return value.get(name, default) if isinstance(value, Mapping) else getattr(value, name, default)


def _safe_completion(completion: str) -> str:
    """Redact and cap actual completion text, never requests or exception bodies."""
    text = re.sub(
        r"(?im)^.*(?:authorization|proxy-authorization|x-api-key|api[_-]?key|"
        r"set-cookie|cookie|password|passwd|client[_-]?secret|access[_-]?token|"
        r"refresh[_-]?token)\s*[\"']?\s*[:=].*$",
        "[REDACTED CREDENTIAL/HEADER]", completion,
    )
    text = re.sub(r"(?i)\bBearer\s+[^\s\"',;<>]+", "Bearer [REDACTED]", text)
    text = re.sub(r"\b(?:sk-|sk_)[A-Za-z0-9_-]+", "[REDACTED KEY]", text)
    text = re.sub(r"\bAIza[A-Za-z0-9_-]+", "[REDACTED KEY]", text)
    text = re.sub(r"(https?://)[^/\s@]+@", r"\1[REDACTED]@", text)
    marker = "\n[TRUNCATED]"
    return text if len(text) <= MAX_RAW_RESPONSE else text[:MAX_RAW_RESPONSE - len(marker)] + marker


class CompletionDiagnostics:
    """Per-call capture; expose only on failure, never inspect LM history."""

    def __init__(self):
        self.raw_response = None
        self.metadata = {}

    def observe_native(self, response):
        # Read only these metadata fields, not messages, transport or provider body.
        choices = _field(response, "choices", ()) or ()
        choice = next(iter(choices), None)
        if choice is not None:
            for name in ("finish_reason", "native_finish_reason"):
                value = _field(choice, name)
                # Finish reasons are bounded provider enum strings, not arbitrary data.
                if isinstance(value, str) and value.casefold() in FINISH_REASONS:
                    self.metadata[name] = value
        usage = _field(response, "usage")
        numeric_usage = {}
        if usage is not None:
            for name in USAGE_FIELDS:
                value = _field(usage, name)
                if type(value) in (int, float) and value >= 0 and (type(value) is int or math.isfinite(value)):
                    numeric_usage[name] = value
            details = _field(usage, "completion_tokens_details")
            reasoning = _field(details, "reasoning_tokens") if details is not None else None
            if type(reasoning) in (int, float) and reasoning >= 0 and (type(reasoning) is int or math.isfinite(reasoning)):
                numeric_usage["completion_tokens_details"] = {"reasoning_tokens": reasoning}
        if numeric_usage:
            self.metadata["usage"] = numeric_usage

    def observe_truncated_completion(self, response):
        """Capture native completion only after a token-limit failure is known."""
        if self.raw_response is not None:
            return
        choice = next(iter(_field(response, "choices", ()) or ()), None)
        message = _field(choice, "message") if choice is not None else None
        text = _field(message, "content") if message is not None else None
        if isinstance(text, str):
            self.raw_response = _safe_completion(text)

    def failure(self):
        if self.raw_response is None and not self.metadata:
            return None
        return {**({"raw_response": self.raw_response} if self.raw_response is not None else {}),
                **self.metadata}


class CompletionCaptureAdapter(dspy.ChatAdapter):
    """One native DSPy call capturing the actual completion at the parse boundary."""

    def __init__(self, preserve_receipts=False, *, normalize_markers=True):
        super().__init__()
        self.preserve_receipts = preserve_receipts
        self.normalize_markers = normalize_markers
        self.capture = CompletionDiagnostics()

    @property
    def raw_response(self):
        return self.capture.raw_response

    def __call__(self, lm, lm_kwargs, signature, demos, inputs):
        from dspy.adapters.base import Adapter
        # ChatAdapter otherwise retries with JSONAdapter after any exception.
        return Adapter.__call__(self, lm, lm_kwargs, signature, demos, inputs)

    def parse(self, signature, completion):
        from dspy.utils.exceptions import AdapterParseError
        self.capture.raw_response = _safe_completion(completion)
        # Preserve existing generator/citation marker behavior.
        if self.normalize_markers:
            completion = re.sub(r"(?<=\S)[ \t]*(\[\[ ## \w+ ## \]\])", r"\n\1", completion)
        score_header = None
        judge_fields = (
            "verdict", "correct_answer_accurate", "distractors_incorrect",
            "distractors_plausible", "explanations_accurate", "scenario_relevant",
            "scenario_clear", "evidence_supported", "score", "reason",
        )
        observed_headers = ("[[ ## score ></br>", "[[ ## score ||> 0.9 <|| ## ]]")
        if not self.normalize_markers and tuple(signature.output_fields) == judge_fields:
            headers = [line for line in completion.splitlines() if "[[" in line]
            malformed = [line for line in headers if line in observed_headers]
            if malformed:
                score_header = malformed[0]
                expected = [f"[[ ## {name} ## ]]" for name in judge_fields] + ["[[ ## completed ## ]]"]
                expected[judge_fields.index("score")] = score_header
                # Repair only the two captured headers, in a complete unambiguous layout.
                if headers != expected:
                    raise AdapterParseError("ChatAdapter", signature, completion,
                                            message="Ambiguous judge field headers")
                completion = completion.replace(score_header, "[[ ## score ## ]]", 1)
        try:
            fields = super().parse(signature, completion)
            # The observed decorated header contains 0.9; never use it as the score
            # or silently discard it if the independently typed body contradicts it.
            if score_header == observed_headers[1] and fields["score"] != 0.9:
                raise AdapterParseError("ChatAdapter", signature, completion,
                                        message="Contradictory judge score header and body")
            return fields
        except AdapterParseError:
            if self.preserve_receipts and "evidence" in signature.output_fields:
                parse_signature = signature.with_updated_fields("evidence", type_=Any)
                return super().parse(parse_signature, completion)
            raise
