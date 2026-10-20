"""Offline documentation-budget seams; these mocks make no model-quality claims."""
from copy import deepcopy
import hashlib
from unittest.mock import Mock

import pytest

from shared import cli_models, llm_generator as generator
from shared.doc_context_budget import build_documentation_context


def source(text):
    return {"url": "https://docs.cloud.google.com/test", "requested_url": "https://docs.cloud.google.com/test",
            "text": text, "retrieved_at": "2026-10-20T00:00:00Z",
            "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest()}


def question():
    return {name: "Synthetic nonempty original text" for name in generator.QUESTION_FIELDS}


@pytest.mark.parametrize("include_evidence", [False, True])
@pytest.mark.parametrize("cap", [0, -1, True, "10", 9])
def test_generation_rejects_invalid_or_oversized_raw_context_before_model(monkeypatch, include_evidence, cap):
    forbidden = Mock(side_effect=AssertionError("No model request"))
    monkeypatch.setattr(cli_models, "run_signature", forbidden)
    with pytest.raises(ValueError):
        generator.generate_question("scope", "文" * 10, model="codex", include_evidence=include_evidence,
                                    doc_context_chars=cap)
    forbidden.assert_not_called()


def test_generation_preserves_unicode_at_exact_character_cap(monkeypatch):
    call = Mock(return_value=question())
    monkeypatch.setattr(cli_models, "run_signature", call)
    assert generator.generate_question("scope", "文" * 10, model="codex", doc_context_chars=10) == question()
    assert call.call_args.args[2]["documentation_context"] == "文" * 10


def test_direct_evidence_writer_enforces_cap_before_predictor():
    forbidden = Mock(side_effect=AssertionError("No predictor"))
    with pytest.raises(ValueError):
        generator.generate_question_with_evidence("scope", "x" * 11, predictor=forbidden, doc_context_chars=10)
    forbidden.assert_not_called()


def test_citation_fallback_budgets_immutable_full_sources_and_protects_known_receipts(monkeypatch):
    text = "prefix " * 1000 + "Exact protected source quote." + " suffix" * 1000
    sources = [source(text)]
    before = deepcopy(sources)
    data = question()
    data["evidence"] = [{"url": sources[0]["url"], "quote": "Exact protected source quote."}]
    call = Mock(return_value={"evidence": []})
    monkeypatch.setattr(cli_models, "run_signature", call)
    result = generator.cite_question(data, sources, "codex", doc_context_chars=1500)
    expected = build_documentation_context(sources, max_chars=1500, receipts=data["evidence"])
    assert call.call_args.args[2]["fetched_sources"] == expected["context"]
    assert "Exact protected source quote." in expected["context"]
    assert len(expected["context"]) <= 1500
    assert result["documentation_context_budget"] == expected["metadata"]
    assert sources == before and data["evidence"][0]["quote"] == "Exact protected source quote."


def test_citation_preserves_supplied_context_and_refuses_oversize(monkeypatch):
    call = Mock(return_value={"evidence": []})
    monkeypatch.setattr(cli_models, "run_signature", call)
    context = "Exact supplied 文 context"
    result = generator.cite_question(question(), [], "codex", fetched_context=context,
                                     doc_context_chars=len(context))
    assert call.call_args.args[2]["fetched_sources"] == context
    assert result["documentation_context_budget"]["context_chars"] == len(context)
    with pytest.raises(ValueError):
        generator.cite_question(question(), [], "codex", fetched_context=context,
                                doc_context_chars=len(context) - 1)
    assert call.call_count == 1


def test_citation_model_failure_still_returns_budget_metadata(monkeypatch):
    sources = [source("Frozen authoritative source text")]
    monkeypatch.setattr(generator, "_generation_lm", Mock(side_effect=RuntimeError("PRIVATE provider body")))
    result = generator.cite_question(question(), sources, "offline", doc_context_chars=1000)
    assert result["evidence"] is None and result["parse_failure"] == "Citation request failed"
    assert result["documentation_context_budget"] == build_documentation_context(sources, max_chars=1000)["metadata"]
    assert "PRIVATE" not in str(result)
