"""Offline lean writer prompts and merged receipt output."""
from copy import deepcopy
import hashlib
import pytest
from shared.decision_planner import writer_documentation_context, DecisionVetoError
from shared.llm_generator import generate_question_with_evidence, QuestionWithEvidenceSignature, QUESTION_FIELDS
from shared.cli_models import output_model


def source(text, name="used"):
    url = "https://docs.cloud.google.com/" + name
    return dict(url=url, requested_url=url, text=text, retrieved_at="2026-10-17T00:00:00Z",
                text_sha256=hashlib.sha256(text.encode()).hexdigest())


def proof(url, quote="evidence anchor"):
    return dict(passed=True, reasons=[dict(option_label=label, url=url, quote=quote)
                                     for label in "ABCD"])


def test_lean_windows_are_exact_merged_and_keep_full_sources_immutable():
    text = "x" * 10000 + "evidence anchor" + "y" * 10000
    sources = [source(text), source("UNUSED DOCUMENT", "unused")]
    before = deepcopy(sources)
    rendered = writer_documentation_context(sources, proof(sources[0]["url"]))
    assert text[2000:18015] in rendered
    assert rendered.count("Source excerpt") == 1
    assert "UNUSED DOCUMENT" not in rendered
    assert sources == before
    assert sources[0]["text_sha256"] in rendered


def test_normalized_quote_maps_to_original_text_and_bad_proof_blocks():
    sources = [source("prefix evidence\n anchor suffix")]
    assert "evidence\n anchor" in writer_documentation_context(sources, proof(sources[0]["url"]))
    with pytest.raises(DecisionVetoError):
        writer_documentation_context(sources, proof(sources[0]["url"], "missing"))
    with pytest.raises(DecisionVetoError):
        writer_documentation_context(sources, {"passed": False})


def test_merged_writer_returns_question_and_receipts_in_one_call():
    calls = []
    data = {field: "Synthetic " + field for field in QUESTION_FIELDS}
    data["evidence"] = proof(source("evidence anchor")["url"])["reasons"]
    def predict(**inputs):
        calls.append(inputs)
        return data
    result = generate_question_with_evidence("scope", "lean docs", predictor=predict)
    assert result == data
    assert len(calls) == 1
    assert calls[0]["documentation_context"] == "lean docs"
    assert "evidence" in output_model(QuestionWithEvidenceSignature).model_fields
