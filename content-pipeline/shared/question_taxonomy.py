"""Strict vocabulary-bound question tags through the subscription CLI transport."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import dspy
from pydantic import BaseModel, ConfigDict, Field
from shared.cli_models import run_signature

BOUNDS = {"decision_type": (1, 1), "constraint": (0, 3), "product": (0, 6), "failure_mode": (0, 3)}
DEFAULT_VOCABULARY = Path(__file__).resolve().parents[1] / "certs/question-taxonomy.json"

class TaxonomyError(ValueError):
    """Invalid vocabulary, tags, or frozen classification inputs."""

class QuestionTag(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    dimension: str
    value_key: str
    confidence: float = Field(strict=True, ge=0, le=1, allow_inf_nan=False)

class QuestionTaxonomySignature(dspy.Signature):
    """Classify only from supplied question evidence. Use only scoped vocabulary values.
    Select exactly one decision_type, up to 3 constraints, 3 products and 3 failure modes.
    Select the most specific decision hinge. select_solution is a last resort for choosing
    a task/model/platform approach, not for runtime, packaging, compute, features or environment.
    Workspace/tool integration or notebook dependency isolation is configure_environment,
    not adapt_model unless prompting, grounding or tuning changes model behavior.
    Shared feature identity, registry, online views or reuse is manage_features,
    not prepare_data when ingestion or transformation is only the supporting step.
    Batch versus online inference, serving containers or request handlers is package_inference,
    not select_solution when the model approach is already fixed.
    Execution hardware, accelerator topology or resource shape is provision_compute,
    not select_solution; interactive notebook setup instead belongs to configure_environment.
    Tag a product only when its capability changes which answer is correct; omit incidental
    mentions, surrounding stack context and distractor-only products. Use at most 3 products.
    Prefer the specific vocabulary subservice; do not also tag its parent platform unless
    the parent independently changes the correct answer. Platform branding alone is not
    product evidence: Gemini Enterprise Agent Platform does not imply Gemini models.
    Constraints must eliminate a plausible alternative, not merely appear as scenario prose.
    Failure modes summarize supported wrong-option reasons, not inferred learner misconceptions.
    Use one primary even for compound items and lower confidence when the fit is uncertain.
    Never align rationale letters to options without the actual option text/is_correct evidence.
    Prefer final question evidence over a stale plan.
    Confidence is finite 0..1; it is model self-assessment, not calibrated probability.
    """
    question_json: str = dspy.InputField(desc="Question, options, rationales, documentation and optional decision plan")
    vocabulary_json: str = dspy.InputField(desc="Allowed tags with definitions and certification scope")
    tags: list[QuestionTag] = dspy.OutputField()

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()

def load_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise TaxonomyError("Duplicate JSON key")
            result[key] = value
        return result
    return json.loads(Path(path).read_text(), object_pairs_hook=unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(TaxonomyError("Nonfinite JSON")))

def validate_vocabulary(vocab):
    if set(vocab) != {"version", "dimensions"} or type(vocab["version"]) is not int or vocab["version"] != 1:
        raise TaxonomyError("Invalid vocabulary version")
    if set(vocab["dimensions"]) != set(BOUNDS):
        raise TaxonomyError("Invalid vocabulary dimensions")
    for dimension, (minimum, maximum) in BOUNDS.items():
        spec = vocab["dimensions"][dimension]
        if set(spec) != {"min", "max", "values"} or type(spec["min"]) is not int or type(spec["max"]) is not int or (spec["min"], spec["max"]) != (minimum, maximum):
            raise TaxonomyError("Invalid vocabulary cardinality")
        if not isinstance(spec["values"], list):
            raise TaxonomyError("Invalid vocabulary values")
        seen = set()
        for value in spec["values"]:
            if set(value) != {"value_key", "label", "definition", "cert_scope"}:
                raise TaxonomyError("Invalid vocabulary value")
            if any(not isinstance(value[k], str) or not value[k].strip() for k in ("value_key", "label", "definition")):
                raise TaxonomyError("Invalid vocabulary text")
            scopes = value["cert_scope"]
            if not isinstance(scopes, list) or not scopes or any(not isinstance(c, str) or not c for c in scopes) or len(scopes) != len(set(scopes)):
                raise TaxonomyError("Invalid certification scope")
            if value["value_key"] in seen:
                raise TaxonomyError("Duplicate vocabulary value")
            seen.add(value["value_key"])
    return vocab

def load_vocabulary(path=DEFAULT_VOCABULARY):
    return validate_vocabulary(load_json(path))

def validate_tags(tags, vocabulary, cert_id):
    validate_vocabulary(vocabulary)
    if not isinstance(tags, list):
        raise TaxonomyError("Tags must be a list")
    counts = dict.fromkeys(BOUNDS, 0)
    seen, result = set(), []
    for raw in tags:
        tag = QuestionTag.model_validate(raw).model_dump()
        dimension, key = tag["dimension"], tag["value_key"]
        if dimension not in BOUNDS or (dimension, key) in seen:
            raise TaxonomyError("Unknown or duplicate tag")
        values = vocabulary["dimensions"][dimension]["values"]
        value = next((v for v in values if v["value_key"] == key), None)
        if value is None or cert_id not in value["cert_scope"]:
            raise TaxonomyError("Tag is not allowed for certification")
        seen.add((dimension, key)); counts[dimension] += 1; result.append(tag)
    if any(not spec["min"] <= counts[d] <= spec["max"] for d, spec in vocabulary["dimensions"].items()):
        raise TaxonomyError("Invalid tag cardinality")
    return sorted(result, key=lambda t: (t["dimension"], t["value_key"]))

def classify_question(question, vocabulary, cert_id, *, model="claude", predictor=run_signature):
    if not (model == "claude" or model.startswith("claude/")):
        raise TaxonomyError("Classifier requires a Claude CLI selector")
    validate_vocabulary(vocabulary)
    output = predictor(model, QuestionTaxonomySignature, {
        "question_json": json.dumps(question, sort_keys=True, allow_nan=False),
        "vocabulary_json": json.dumps(vocabulary, sort_keys=True, allow_nan=False)})
    if not isinstance(output, dict) or set(output) != {"tags"}:
        raise TaxonomyError("Unexpected classification fields")
    tags = validate_tags(output["tags"], vocabulary, cert_id)
    if sum(tag["dimension"] == "product" for tag in tags) > 3:
        raise TaxonomyError("Classifier must select at most 3 decisive products")
    return tags


def generation_receipt(scope, *, model="claude", predictor=run_signature):
    vocabulary = load_vocabulary()
    plan = scope["decision_plan"]
    tags = classify_question({"cert_id": scope["cert_id"], "objective_id": scope["objective_id"],
                              "decision_plan": plan}, vocabulary, scope["cert_id"],
                             model=model, predictor=predictor)
    return {"version": 1, "vocabulary_hash": digest(vocabulary), "plan_hash": digest(plan),
            "model": model, "tags": tags}


def validate_generation_receipt(receipt, scope):
    vocabulary = load_vocabulary()
    if (not isinstance(receipt, dict)
            or set(receipt) != {"version", "vocabulary_hash", "plan_hash", "model", "tags"}
            or type(receipt["version"]) is not int or receipt["version"] != 1
            or receipt["vocabulary_hash"] != digest(vocabulary)
            or receipt["plan_hash"] != digest(scope["decision_plan"])
            or not isinstance(receipt["model"], str)
            or not (receipt["model"] == "claude" or receipt["model"].startswith("claude/"))):
        raise TaxonomyError("Invalid frozen generation tags")
    return validate_tags(receipt["tags"], vocabulary, scope["cert_id"])


def persist_tags(client, question_id, source, tags):
    client.client.rpc("replace_question_tags", {"p_question_id": question_id,
        "p_source": source, "p_tags": tags}).execute()
