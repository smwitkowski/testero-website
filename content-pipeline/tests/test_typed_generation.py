"""Typed generation and retry proof contracts with mocked DSPy only."""
import importlib
import json
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from dspy.utils import DummyLM

from shared import llm_generator as generator
from shared.evidence import OptionEvidence


def output(prefix="Original"):
    fields = {name: f" {prefix} {name} " for name in generator.QUESTION_FIELDS}
    fields["evidence"] = [OptionEvidence(option_label=label,
        url="https://docs.cloud.google.com/source", quote=f"{prefix} fact {label}") for label in "ABCD"]
    return SimpleNamespace(**fields)


def test_signatures_have_typed_evidence_and_registry_scope():
    for signature in [generator.PmleQuestionSignature, generator.QuestionCorrectionSignature,
                      generator.FactualCorrectionSignature]:
        assert signature.output_fields["evidence"].annotation == list[OptionEvidence] | None
    instructions = generator.PmleQuestionSignature.instructions
    assert "registry objective" in instructions
    assert "Professional Machine Learning Engineer builds" not in instructions
    assert "foundational" in instructions


def test_direct_generator_passes_scope_and_per_call_lm_without_legacy(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-test-only")
    monkeypatch.setitem(sys.modules, "shared.pmle_program", None)
    lm = object()
    make_lm = Mock(return_value=lm)
    predictor = Mock(return_value=output())
    make_predictor = Mock(return_value=predictor)
    monkeypatch.setattr(generator.dspy, "LM", make_lm)
    monkeypatch.setattr(generator.dspy, "ChainOfThought", make_predictor)
    result = generator.generate_question("Registry objective + STYLE", "Fetched text", model="openrouter/test/model",
                                        difficulty="EASY", exam_subsection="1.2", prompt_version="test")
    assert result["stem"] == "Original stem"
    assert len(result["evidence"]) == 4
    assert result["evidence"][0] == {"option_label": "A", "url": "https://docs.cloud.google.com/source", "quote": "Original fact A"}
    make_predictor.assert_called_once_with(generator.PmleQuestionSignature)
    assert predictor.call_args.kwargs["lm"] is lm
    assert predictor.call_args.kwargs["domain_context"] == "Registry objective + STYLE"
    assert predictor.call_args.kwargs["documentation_context"] == "Fetched text"
    assert predictor.call_args.kwargs["exam_subsection"] == "1.2"
    assert make_lm.call_args.kwargs["model"] == "openrouter/test/model"
    assert make_lm.call_args.kwargs["cache"] is False


@pytest.mark.parametrize("scope,docs", [("", "Docs"), ("Scope", ""), (" ", "Docs"), ("Scope", " ")])
def test_missing_scope_or_documentation_never_calls_lm(monkeypatch, scope, docs):
    fake = Mock()
    monkeypatch.setattr(generator.dspy, "LM", fake)
    with pytest.raises(ValueError, match="required"):
        generator.generate_question(scope, docs)
    fake.assert_not_called()


def test_missing_key_never_calls_lm(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    fake = Mock()
    monkeypatch.setattr(generator.dspy, "LM", fake)
    with pytest.raises(ValueError, match="environment"):
        generator.generate_question("Scope", "Docs")
    fake.assert_not_called()


def test_missing_evidence_retains_candidate_for_mechanical_rejection():
    result = output()
    del result.evidence
    extracted = generator._question_data(result)
    assert extracted["stem"] == "Original stem"
    assert extracted["evidence"] is None


def test_facade_retry_replaces_all_proof_instead_of_merging_stale(monkeypatch):
    facade = generator.LLMGenerator.__new__(generator.LLMGenerator)
    facade.temperature = 0.7
    facade.generator = Mock(return_value=output("Original"))
    facade.corrector = Mock(return_value=output("Corrected"))
    validator = Mock(side_effect=[
        SimpleNamespace(is_valid=False, errors=["Correct an option"]),
        SimpleNamespace(is_valid=True, errors=[]),
    ])
    result, attempts = facade.generate_question_with_retry("Registry objective", "Fetched text", validator_fn=validator)
    assert attempts == 2
    assert result["stem"] == "Corrected stem"
    assert all(r["quote"].startswith("Corrected") for r in result["evidence"])
    sent_original = json.loads(facade.corrector.call_args.kwargs["original_question"])
    assert all(r["quote"].startswith("Original") for r in sent_original["evidence"])
    assert result == generator._question_data(output("Corrected"))


def test_import_does_not_load_dotenv(monkeypatch):
    import dotenv
    fake = Mock(side_effect=AssertionError("No credential file reads"))
    monkeypatch.setattr(dotenv, "load_dotenv", fake)
    importlib.reload(generator)
    fake.assert_not_called()


def test_real_dspy_adapter_parses_typed_evidence_with_offline_lm(monkeypatch):
    values = vars(output())
    values["reasoning"] = "Within the supplied objective scope."
    values["evidence"] = [r.model_dump() for r in values["evidence"]]
    lm = DummyLM([values])
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-test-only")
    monkeypatch.setattr(generator.dspy, "LM", lambda **kwargs: lm)
    result = generator.generate_question("Registry objective + STYLE", "Fetched documentation")
    assert result["evidence"] == values["evidence"]
    assert len(lm.history) == 1
