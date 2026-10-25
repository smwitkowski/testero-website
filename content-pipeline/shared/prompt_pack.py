"""Versioned, writer-only prompt packs; no global signature mutation or judge hooks.

Build with ``create_pack`` (alias ``make_pack``), persist with ``save_pack``, and
activate with ``use_prompt_pack`` inside an explicit writer scope. Only the base
writer is patched: caller-owned practitioner and policy transforms run afterward.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from typing import Any, Literal

import dspy
from pydantic import BaseModel, ConfigDict, Field, create_model


class PromptPackError(ValueError):
    """A pack is invalid, stale, or targets a non-writer signature."""


class _Writer(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    signature: str
    base_signature_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    instructions: str | None = None
    demos: list[dict[str, Any]] = Field(default_factory=list)
    components: dict[str, str] | None = None
    exemplars: list[dict[str, Any]] | None = None
    frozen_rubric: str | None = None


class _Pack(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", allow_inf_nan=False)
    version: Literal[1]
    stage: Literal["plan", "draft"]
    policy: dict[str, Any]
    source_run: str = Field(min_length=1)
    scores: dict[str, float]
    writers: list[_Writer]


_ACTIVE: ContextVar[dict | None] = ContextVar("testero_writer_prompt_pack", default=None)


def _registry():
    # Lazy imports avoid a signature-definition cycle. Identity, not a class name
    # or matching output fields, establishes which trusted base may be edited.
    from shared.decision_planner import DecisionPlanSignature
    from shared.llm_generator import PmleQuestionSignature, QuestionWithEvidenceSignature, CitationSignature
    return {signature.__name__: (stage, signature) for stage, signature in (
        ("plan", DecisionPlanSignature), ("draft", PmleQuestionSignature),
        ("draft", QuestionWithEvidenceSignature), ("draft", CitationSignature))}


def _base(signature):
    registry = _registry()
    if isinstance(signature, str):
        if signature not in registry:
            raise PromptPackError("Prompt packs may target only allowlisted writer signatures; judges/proofs/vetoes are frozen")
        return registry[signature]
    for stage, base in registry.values():
        if signature is base:
            return stage, base
    raise PromptPackError("Prompt packs require a trusted base writer signature, never a judge or transformed signature")


def _canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def signature_hash(signature):
    """Hash the trusted base's instructions and typed field schema."""
    _, base = _base(signature)
    data = {"instructions": base.instructions, "schema": base.model_json_schema()}
    return hashlib.sha256(_canonical(data).encode("utf-8")).hexdigest()


def _demo(base, values):
    from shared.cli_models import output_model
    if set(values) != set(base.fields):
        raise PromptPackError("A demo must contain exactly all writer input and output fields")
    inputs = create_model("PromptPackInputs", __config__=ConfigDict(strict=True, extra="forbid"),
        **{name: (field.rebuild_annotation(), ...) for name, field in base.input_fields.items()})
    normalized = inputs.model_validate({name: values[name] for name in base.input_fields}).model_dump(mode="json")
    normalized.update(output_model(base).model_validate(
        {name: values[name] for name in base.output_fields}).model_dump(mode="json"))
    return normalized


def validate_pack(pack):
    """Return an independent JSON-safe pack; reject unknown fields and stale bases."""
    try:
        if not isinstance(pack, dict) or type(pack.get("version")) is not int:
            raise PromptPackError("Prompt pack version must be integer 1")
        # Check raw metadata before Pydantic can serialize NaN to null.
        _canonical(pack)
        parsed = _Pack.model_validate(pack).model_dump(mode="json")
        names = set()
        for writer in parsed["writers"]:
            stage, base = _base(writer["signature"])
            if stage != parsed["stage"]:
                raise PromptPackError("Writer signature does not match pack stage")
            if writer["signature"] in names:
                raise PromptPackError("Duplicate writer signature in prompt pack")
            names.add(writer["signature"])
            if writer["base_signature_hash"] != signature_hash(base):
                raise PromptPackError("Prompt pack base signature hash is stale")
            if writer["instructions"] is not None and not writer["instructions"].strip():
                raise PromptPackError("Optimized instructions must be nonempty, or null for unchanged")
            writer["demos"] = [_demo(base, demo) for demo in writer["demos"]]
            additions = ("components", "exemplars", "frozen_rubric")
            if any(writer[key] is not None for key in additions):
                from shared.plan_components import validate_components, frozen_decision_rules
                if stage != "plan":
                    raise PromptPackError("Named plan components require a plan writer")
                if writer["components"] is not None:
                    writer["components"] = validate_components(writer["components"])
                    if writer["instructions"] is not None and "plan.instructions" in writer["components"]:
                        raise PromptPackError("Use either instructions or plan.instructions, not both")
                if writer["exemplars"] is not None:
                    writer["exemplars"] = _compact_exemplars(writer["exemplars"])
                if writer["frozen_rubric"] is not None and writer["frozen_rubric"] != frozen_decision_rules():
                    raise PromptPackError("Frozen decision rubric must be verbatim")
            # Old v1 packs must retain their content hashes and normalized shape.
            for key in additions:
                if writer[key] is None:
                    del writer[key]
        return parsed
    except PromptPackError:
        raise
    except (ValueError, TypeError, RecursionError):
        raise PromptPackError("Invalid prompt pack schema or typed demo") from None


def create_pack(*, stage, signature=None, instructions=None, demos=(), policy, source_run, scores,
                components=None, exemplars=None, frozen_rubric=None):
    """Create one writer entry (or an empty identity pack with signature=None).

    Demos are complete dictionaries or DSPy Examples, with no optimizer metadata.
    Pass the trusted base separately from an optimizer's transformed signature.
    """
    writers = []
    if signature is not None:
        _, base = _base(signature)
        normalized = []
        for demo in demos:
            values = demo.toDict() if isinstance(demo, dspy.Example) else dict(demo)
            normalized.append(_demo(base, values))
        writers = [{"signature": base.__name__, "base_signature_hash": signature_hash(base),
                    "instructions": instructions, "demos": normalized,
                    "components": components, "exemplars": exemplars, "frozen_rubric": frozen_rubric}]
    elif instructions is not None or demos or components is not None or exemplars is not None or frozen_rubric is not None:
        raise PromptPackError("Instructions/demos require a writer signature")
    return validate_pack({"version": 1, "stage": stage, "policy": policy, "source_run": source_run,
                          "scores": scores, "writers": writers})


make_pack = create_pack


def save_pack(pack, path):
    """Validate and save a pack. Return its normalized data."""
    validated = validate_pack(pack)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(validated, indent=2, ensure_ascii=False, allow_nan=False) + "\n")
    return validated


def load_pack(path):
    """Read strict JSON (no duplicate keys or nonfinite constants) and validate."""
    from shared.cli_models import _load_json
    try:
        data = _load_json(Path(path).read_text())
    except (OSError, UnicodeError, ValueError, RecursionError):
        raise PromptPackError("Prompt pack could not be read as strict JSON") from None
    return validate_pack(data)


def pack_hash(pack):
    """Stable content hash for generation/evaluation artifact provenance."""
    return hashlib.sha256(_canonical(validate_pack(pack)).encode("utf-8")).hexdigest()


@contextmanager
def use_prompt_pack(pack):
    """Apply in this context/thread only; nested scopes restore the previous pack."""
    token = _ACTIVE.set(None if pack is None else validate_pack(pack))
    try:
        yield
    finally:
        _ACTIVE.reset(token)


def _entry(signature):
    _, base = _base(signature)
    pack = _ACTIVE.get()
    if pack is None:
        return None
    return next((entry for entry in pack["writers"] if entry["signature"] == base.__name__), None)


def writer_signature(signature):
    """Patch trusted base instructions before practitioner/policy/order transforms."""
    entry = _entry(signature)
    if entry is None:
        return signature
    instructions = entry.get("components", {}).get("plan.instructions", entry["instructions"])
    if instructions is None:
        return signature
    selected = signature.with_instructions(instructions)
    selected.__name__ = signature.__name__
    return selected


def writer_demos(signature):
    """Return typed, independent DSPy demos for an explicitly named base writer."""
    entry = _entry(signature)
    if entry is None:
        return []
    return [dspy.Example(**deepcopy(values)).with_inputs(*signature.input_fields)
            for values in entry["demos"]]


def _compact_exemplars(records):
    from shared.decision_planner import DecisionPlan
    if len(records) > 3:
        raise PromptPackError("At most three compact plan exemplars are allowed")
    normalized = []
    seen = set()
    for record in records:
        if set(record) != {"domain", "cert_id", "objective_id", "plan"}:
            raise PromptPackError("Exemplars contain only domain, cert_id, objective_id and plan; no docs")
        if any(not isinstance(record[key], str) or not record[key].strip()
               for key in ("domain", "cert_id", "objective_id")):
            raise PromptPackError("Exemplar domain, cert_id and objective are required")
        plan = DecisionPlan.model_validate(record["plan"]).model_dump(mode="json")
        if plan["objective_id"] != record["objective_id"] or record["objective_id"] in seen:
            raise PromptPackError("Exemplars need distinct, matching objectives")
        if len(_canonical(plan)) > 8000:
            raise PromptPackError("Compact exemplar plan exceeds 8000 characters")
        seen.add(record["objective_id"])
        normalized.append({**record, "plan": plan})
    return normalized


def writer_component(name):
    """Return a named plan override, otherwise its byte-identical default."""
    from shared.decision_planner import DecisionPlanSignature
    from shared.plan_components import default_components
    defaults = default_components()
    if name not in defaults:
        raise PromptPackError("Unknown plan component")
    entry = _entry(DecisionPlanSignature)
    return defaults[name] if entry is None else entry.get("components", {}).get(name, defaults[name])
