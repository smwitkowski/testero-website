"""Replay actual clipped batch-1 diagnostics; never fabricate missing outputs."""
import hashlib
import json
from pathlib import Path

import dspy
from dspy.utils.exceptions import AdapterParseError
import pytest

from shared.llm_generator import CompletionCaptureAdapter, PmleQuestionSignature

FIXTURE_PATH = Path(__file__).parent / "fixtures/pmle_batch1_generation_prefixes.json"
FIXTURE = json.loads(FIXTURE_PATH.read_text())


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda item: str(item["index"]))
def test_real_prefix_normalization_recovers_stem_but_never_accepts_partial_output(case):
    raw = case["raw_response"]
    assert len(raw) == 2048 and raw.endswith("\n[TRUNCATED]")
    assert hashlib.sha256(raw.encode()).hexdigest() == case["raw_sha256"]
    signature = dspy.ChainOfThought(PmleQuestionSignature).predict.signature
    with pytest.raises(AdapterParseError) as native:
        dspy.ChatAdapter().parse(signature, raw)
    adapter = CompletionCaptureAdapter()
    with pytest.raises(AdapterParseError) as current:
        adapter.parse(signature, raw)
    assert "stem" not in native.value.parsed_result
    assert "stem" in current.value.parsed_result
    assert adapter.raw_response == raw
    assert set(current.value.parsed_result) < set(signature.output_fields)


def test_original_batch_provenance_when_available():
    artifact = Path(__file__).parents[1] / FIXTURE["provenance"]["artifact"]
    if not artifact.exists():
        return
    assert hashlib.sha256(artifact.read_bytes()).hexdigest() == FIXTURE["provenance"]["artifact_sha256"]
    candidates = json.loads(artifact.read_text())["candidates"]
    for case in FIXTURE["cases"]:
        original = next(c for c in candidates if c["index"] == case["index"])
        assert original["objective_id"] == case["objective_id"]
        assert original["error_class"] == "GenerationOutputError"
        assert original["raw_response"] == case["raw_response"]
