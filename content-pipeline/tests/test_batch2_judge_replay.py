"""Offline replay of the two complete batch-2 judge format failures."""

import hashlib
import json
from pathlib import Path
from unittest.mock import Mock

import dspy
from dspy.utils.exceptions import AdapterParseError
import pytest

from shared.completion_diagnostics import CompletionCaptureAdapter
from shared import quality_gate as gate

FIXTURE_PATH = Path(__file__).parent / "fixtures/pmle_batch2_judge_completions.json"
FIXTURE = json.loads(FIXTURE_PATH.read_text())
CASES = FIXTURE["cases"]
# The real historical outputs contain only seven checks. Parse them only under
# their recorded schema; never add invented style verdicts to real completions.
LEGACY_SIGNATURE = gate.QuestionQualitySignature
for name in gate.STYLE_CHECKS:
    LEGACY_SIGNATURE = LEGACY_SIGNATURE.delete(name)
LEGACY_CHECKS = tuple(name for name in gate.ACCURACY_CHECKS if name not in gate.STYLE_CHECKS)

HEADERS = ("[[ ## score ></br>", "[[ ## score ||> 0.9 <|| ## ]]")


def score_header(raw):
    return next(line for line in raw.splitlines() if line in HEADERS)


def replay(case, raw):
    adapter = CompletionCaptureAdapter(normalize_markers=False)
    diagnostics = case["diagnostics"]
    adapter.capture.observe_native({"choices": [{"finish_reason": diagnostics["finish_reason"]}],
                                    "usage": diagnostics["usage"]})
    lm = Mock(return_value=[raw])

    def predict(**inputs):
        fields = adapter(lm, {}, LEGACY_SIGNATURE, [], inputs)[0]
        return dspy.Prediction(**fields)

    predictor = Mock(side_effect=predict)
    verdict = gate.judge_question(
        case["question_data"], case["objective_id"],
        documentation_context=json.dumps(case["evidence"]),
        option_evidence=case["evidence"], model=case["model"], predictor=predictor,
    )
    assert predictor.call_count == 1 and lm.call_count == 1
    assert adapter.raw_response == raw
    assert adapter.capture.metadata == {key: diagnostics[key] for key in ("finish_reason", "usage")}
    return verdict


@pytest.mark.parametrize("case", CASES, ids=lambda case: str(case["index"]))
def test_real_completion_repairs_legacy_schema_but_missing_style_checks_now_fail_closed(case):
    raw = case["diagnostics"]["raw_response"]
    assert hashlib.sha256(raw.encode()).hexdigest() == case["raw_sha256"]
    assert case["diagnostics"]["finish_reason"] == "stop"
    assert raw.endswith("[[ ## completed ## ]]") and "[TRUNCATED]" not in raw
    assert case["mechanical_check"] == {"passed": True, "errors": []}
    with pytest.raises(AdapterParseError, match="Failed to parse field evidence_supported"):
        dspy.ChatAdapter().parse(LEGACY_SIGNATURE, raw)
    fields = CompletionCaptureAdapter(normalize_markers=False).parse(LEGACY_SIGNATURE, raw)
    canonical = dspy.ChatAdapter().parse(
        LEGACY_SIGNATURE, raw.replace(score_header(raw), "[[ ## score ## ]]", 1),
    )
    assert fields == canonical
    assert fields["verdict"] == "PASS" and type(fields["score"]) is float and fields["score"] == 0.9
    assert all(type(fields[name]) is bool and fields[name] for name in LEGACY_CHECKS)
    verdict = replay(case, raw)
    assert not verdict.passed and verdict.score == 0.0


@pytest.mark.parametrize("case", CASES, ids=lambda case: str(case["index"]))
@pytest.mark.parametrize("field,value", [("verdict", "FAIL"), ("verdict", "UNCERTAIN"),
                                         *[(name, "False") for name in LEGACY_CHECKS]])
def test_real_repair_cannot_override_verdict_or_any_rubric_check(case, field, value):
    raw = case["diagnostics"]["raw_response"]
    old = "PASS" if field == "verdict" else "True"
    raw = raw.replace(f"[[ ## {field} ## ]]\n{old}", f"[[ ## {field} ## ]]\n{value}", 1)
    verdict = replay(case, raw)
    assert not verdict.passed and verdict.score == 0.0


@pytest.mark.parametrize("case", CASES, ids=lambda case: str(case["index"]))
def test_low_body_score_never_passes_or_uses_decorated_header_score(case):
    raw = case["diagnostics"]["raw_response"]
    raw = raw.replace(score_header(raw) + "\n0.9", score_header(raw) + "\n0.79", 1)
    verdict = replay(case, raw)
    assert not verdict.passed
    assert verdict.score == 0 and verdict.reason == "Judge failed or returned invalid output"


def test_decorated_header_cannot_discard_contradictory_above_threshold_body():
    case = next(case for case in CASES if case["index"] == 8)
    raw = case["diagnostics"]["raw_response"]
    raw = raw.replace(HEADERS[1] + "\n0.9", HEADERS[1] + "\n0.95", 1)
    with pytest.raises(AdapterParseError, match="Contradictory judge score header and body"):
        CompletionCaptureAdapter(normalize_markers=False).parse(LEGACY_SIGNATURE, raw)
    verdict = replay(case, raw)
    assert not verdict.passed and verdict.score == 0


@pytest.mark.parametrize("case", CASES, ids=lambda case: str(case["index"]))
@pytest.mark.parametrize("mutation", ["unknown_score", "unknown_field", "missing_field", "duplicate_score",
                                      "duplicate_verdict", "missing_score_body", "invalid_score_body",
                                      "header_only_score", "decorated_other_score", "glued_header"])
def test_unknown_missing_ambiguous_or_untyped_mutations_fail_closed_without_retry(case, mutation):
    raw = case["diagnostics"]["raw_response"]
    header = score_header(raw)
    if mutation == "unknown_score":
        raw = raw.replace(header, "[[ ## score broken ## ]]", 1)
    elif mutation == "unknown_field":
        raw = raw.replace("[[ ## reason ## ]]", "[[ ## extra ## ]]\nunknown\n\n[[ ## reason ## ]]", 1)
    elif mutation == "missing_field":
        raw = raw.replace("[[ ## scenario_clear ## ]]\nTrue\n\n", "", 1)
    elif mutation == "duplicate_score":
        raw = raw.replace(header, "[[ ## score ## ]]\n0.1\n\n" + header, 1)
    elif mutation == "duplicate_verdict":
        raw = "[[ ## verdict ## ]]\nFAIL\n\n" + raw
    elif mutation == "missing_score_body":
        raw = raw.replace(header + "\n0.9", header, 1)
    elif mutation == "invalid_score_body":
        raw = raw.replace(header + "\n0.9", header + "\nnot-a-number", 1)
    elif mutation == "header_only_score":
        raw = raw.replace(header + "\n0.9", "[[ ## score ||> 0.9 <|| ## ]]", 1)
    elif mutation == "decorated_other_score":
        raw = raw.replace(header, "[[ ## score ||> 0.8 <|| ## ]]", 1)
    elif mutation == "glued_header":
        raw = raw.replace("True\n\n" + header, "True" + header, 1)
    verdict = replay(case, raw)
    assert not verdict.passed and verdict.score == 0
    assert verdict.reason == "Judge failed or returned invalid output"


def test_original_completion_provenance_when_artifact_available():
    artifact = Path(__file__).parents[1] / FIXTURE["provenance"]["artifact"]
    if not artifact.exists():
        return
    assert hashlib.sha256(artifact.read_bytes()).hexdigest() == FIXTURE["provenance"]["artifact_sha256"]
    candidates = json.loads(artifact.read_text())["candidates"]
    for case in CASES:
        candidate = next(candidate for candidate in candidates if candidate["index"] == case["index"])
        assert candidate["objective_id"] == case["objective_id"]
        assert candidate["judge_verdict"]["reason"] == "Judge failed or returned invalid output"
        assert candidate["judge_verdict"]["diagnostics"] == case["diagnostics"]
        assert candidate["evidence"] == case["evidence"]


@pytest.mark.parametrize("case", CASES, ids=lambda case: str(case["index"]))
def test_real_old_output_cannot_parse_current_ten_check_signature(case):
    raw = case["diagnostics"]["raw_response"]
    with pytest.raises(AdapterParseError):
        CompletionCaptureAdapter(normalize_markers=False).parse(gate.QuestionQualitySignature, raw)
