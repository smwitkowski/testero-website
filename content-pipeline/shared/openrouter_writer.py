"""Offline-configured OpenRouter writer adapters; no discovery or hidden retry."""
import json
import os
import re
from typing import Any

import dspy
from pydantic import ValidationError

from shared.cli_models import _codex_response_schema, _load_json, output_model
from shared.completion_diagnostics import CompletionCaptureAdapter, CompletionDiagnostics

MODEL_PARAMETERS_ENV = "TESTERO_OPENROUTER_MODEL_PARAMETERS"


def supports_structured_output(model):
    """Read an explicit model-to-supported_parameters map, never query a provider."""
    try:
        configured = json.loads(os.environ.get(MODEL_PARAMETERS_ENV, "{}"))
        if not isinstance(configured, dict) or any(
            not isinstance(key, str) or not isinstance(value, list)
            or any(not isinstance(item, str) for item in value)
            for key, value in configured.items()
        ):
            raise ValueError
    except (ValueError, TypeError):
        raise ValueError("Invalid OpenRouter writer model-parameters configuration") from None
    ident = model.removeprefix("openrouter/")
    parameters = configured.get(model, configured.get(ident, []))
    return bool({"structured_outputs", "response_format"}.intersection(parameters))


class WriterOutputError(ValueError):
    """Writer output failed strict validation; details live in safe diagnostics."""


def _validation_failure(capture, errors):
    # Field names come from our schemas, but extra keys can contain arbitrary
    # answer text. Never retain those keys, input values, messages, or contexts.
    capture.raw_response = None
    capture.metadata["validation_errors"] = [
        {"path": [part if type(part) is int else
                  "<extra>" if error["type"] == "extra_forbidden" and index == len(error["loc"]) - 1
                  else part if re.fullmatch(r"[A-Za-z_]\w{0,79}", str(part)) else "<field>"
                  for index, part in enumerate(error["loc"])],
         "type": error["type"]}
        for error in errors[:50]
    ]
    raise WriterOutputError("Writer output does not match the schema") from None


def validate_writer_output(raw, signature, capture):
    """Apply exactly the CLI output model, without scalar coercion."""
    try:
        return output_model(signature).model_validate(raw).model_dump()
    except ValidationError as error:
        _validation_failure(capture, error.errors(include_input=False, include_context=False, include_url=False))


class WriterChatAdapter(CompletionCaptureAdapter):
    """Keep typed prompts but defer nested validation to the strict CLI model."""

    def parse(self, signature, completion):
        parse_signature = signature
        for name, field in signature.output_fields.items():
            if field.annotation is not str:
                parse_signature = parse_signature.with_updated_fields(name, type_=Any)
        raw = super().parse(parse_signature, completion)
        return validate_writer_output(raw, signature, self.capture)


class WriterJSONAdapter(dspy.JSONAdapter):
    """One schema-enforced call; parse exact JSON, not repaired JSON or markers."""

    def __init__(self):
        super().__init__(use_native_function_calling=False)
        self.capture = CompletionDiagnostics()

    @property
    def raw_response(self):
        return self.capture.raw_response

    def __call__(self, lm, lm_kwargs, signature, demos, inputs):
        from dspy.adapters.base import Adapter
        response_format = {
            "type": "json_schema",
            "json_schema": {"name": "writer_output", "strict": True,
                            "schema": _codex_response_schema(output_model(signature).model_json_schema())},
        }
        # JSONAdapter.__call__ performs discovery and can silently retry. Use
        # only its formatter, with an explicit schema on the single native call.
        return Adapter.__call__(self, lm, {**lm_kwargs, "response_format": response_format},
                                signature, demos, inputs)

    def parse(self, signature, completion):
        try:
            raw = _load_json(completion)
        except (ValueError, TypeError, RecursionError):
            _validation_failure(self.capture, [{"loc": (), "type": "json_invalid"}])
        return validate_writer_output(raw, signature, self.capture)
