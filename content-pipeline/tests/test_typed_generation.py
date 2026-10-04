"""Question-only generation and separate typed citations, using offline DSPy LMs."""
import hashlib
import importlib
import json
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from dspy.utils import DummyLM
from pydantic import ValidationError

from shared import llm_generator as generator
from shared.evidence import OptionEvidence, check_evidence


def output(prefix="Original"):
    return SimpleNamespace(**{name: f" {prefix} {name} " for name in generator.QUESTION_FIELDS})


def source(text="Exact Cloud Storage fact."):
    url = "https://docs.cloud.google.com/source"
    return {"url": url, "requested_url": url, "text": text,
            "retrieved_at": "2026-10-04T00:00:00Z",
            "text_sha256": hashlib.sha256(text.encode()).hexdigest()}


def evidence():
    return [{"option_label": label, "url": source()["url"],
             "quote": "Cloud Storage fact."} for label in "ABCD"]


def install_lm(monkeypatch, values):
    lm = DummyLM(values)
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-test-only")
    monkeypatch.setattr(generator.dspy, "LM", lambda **kwargs: lm)
    return lm


def test_question_signatures_have_only_string_question_fields():
    for signature in [generator.PmleQuestionSignature, generator.QuestionCorrectionSignature,
                      generator.FactualCorrectionSignature]:
        assert set(signature.output_fields) == set(generator.QUESTION_FIELDS)
        assert all(field.annotation is str for field in signature.output_fields.values())
    instructions = generator.PmleQuestionSignature.instructions
    assert "registry objective" in instructions
    assert "Professional Machine Learning Engineer builds" not in instructions
    assert "foundational" in instructions


def test_citation_lm_schema_is_required_strict_receipt_list():
    signature = generator.CitationSignature
    assert list(signature.output_fields) == ["evidence"]
    assert signature.output_fields["evidence"].annotation == list[OptionEvidence]
    assert all(field.annotation is str for field in signature.input_fields.values())
    schema = OptionEvidence.model_json_schema()
    assert set(schema["required"]) == {"option_label", "url", "quote"}
    assert all(schema["properties"][name]["type"] == "string" for name in schema["required"])
    for malformed in [{"option_label": "A", "url": source()["url"]},
                      {"option_label": "A", "url": source()["url"], "quote": 42}]:
        with pytest.raises(ValidationError):
            OptionEvidence(**malformed)


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
    assert set(result) == set(generator.QUESTION_FIELDS)
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


def test_extraction_ignores_stale_evidence():
    result = output()
    result.evidence = evidence()
    assert set(generator._question_data(result)) == set(generator.QUESTION_FIELDS)


def test_facade_retry_replaces_question_without_any_proof(monkeypatch):
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
    assert "evidence" not in result
    sent_original = json.loads(facade.corrector.call_args.kwargs["original_question"])
    assert "evidence" not in sent_original
    assert result == generator._question_data(output("Corrected"))


def test_import_does_not_load_dotenv(monkeypatch):
    import dotenv
    fake = Mock(side_effect=AssertionError("No credential file reads"))
    monkeypatch.setattr(dotenv, "load_dotenv", fake)
    importlib.reload(generator)
    fake.assert_not_called()


def test_real_dspy_question_call_returns_only_question(monkeypatch):
    values = {**vars(output()), "reasoning": "Within the supplied objective scope."}
    lm = install_lm(monkeypatch, [values])
    result = generator.generate_question("Registry objective + STYLE", "Fetched documentation")
    assert result == generator._question_data(output())
    assert "evidence" not in lm.history[0]["messages"][0]["content"]
    assert len(lm.history) == 1


def test_real_dspy_parses_strict_typed_citations(monkeypatch):
    values = {"evidence": evidence()}
    lm = install_lm(monkeypatch, [values])
    result = generator.cite_question(vars(output()), [source()], "offline/model")
    assert result == values
    assert check_evidence(result["evidence"], [source()])["passed"]
    assert len(lm.history) == 1
    prompt = lm.history[0]["messages"][-1]["content"]
    assert "Original correct_answer" in prompt and "Original distractor_3_explanation" in prompt
    assert source()["url"] in prompt and source()["text"] in prompt


@pytest.mark.parametrize("malformation", ["long_quote", "missing_field", "non_string", "invalid_label", "null_record"])
def test_real_dspy_preserves_invalid_receipts_for_mechanical_rejection(monkeypatch, malformation):
    records = evidence()
    if malformation == "long_quote":
        records[0]["quote"] = "x" * 301
    elif malformation == "missing_field":
        del records[0]["quote"]
    elif malformation == "non_string":
        records[0]["quote"] = 42
    elif malformation == "invalid_label":
        records[0]["option_label"] = ["A"]
    else:
        records[0] = None
    lm = install_lm(monkeypatch, [{"evidence": records}])
    result = generator.cite_question(vars(output()), [source()], "offline/model")
    assert result == {"evidence": records}
    mechanical = check_evidence(result["evidence"], [source()])
    assert not mechanical["passed"] and mechanical["errors"]
    assert len(lm.history) == 1
    schema_prompt = lm.history[0]["messages"][0]["content"]
    assert "Any" not in schema_prompt
    assert all(field.annotation is str for field in OptionEvidence.model_fields.values())


def test_root_can_retry_with_errors_and_citation_does_not_edit_question(monkeypatch):
    question = vars(output())
    before = dict(question)
    records = evidence()
    records[0]["quote"] = "not in source"
    lm = install_lm(monkeypatch, [{"evidence": records}, {"evidence": evidence()}])
    first = generator.cite_question(question, [source()], "offline/model")
    assert len(lm.history) == 1
    errors = check_evidence(first["evidence"], [source()])["errors"]
    second = generator.cite_question(question, [source()], "offline/model", check_errors=errors)
    assert check_evidence(second["evidence"], [source()])["passed"]
    assert errors[0] in lm.history[1]["messages"][-1]["content"]
    assert question == before and len(lm.history) == 2


def test_citation_parse_failure_uses_bounded_redacted_actual_completion(monkeypatch):
    completion_body = ("Actual output only.\nAuthorization: Bearer fake-secret\n"
                       "X-API-Key: fake-api-secret\nCookie: fake-cookie-secret\n"
                       "api_key=another-fake-secret\nStandalone sk-fake-key and Bearer fake-inline-token\n"
                       "https://fake-user:fake-password@example.invalid/\n" + "z" * 4000)
    lm = install_lm(monkeypatch, [{"unrelated": completion_body}])
    result = generator.cite_question(vars(output()), [source()], "offline/model")
    assert result["evidence"] is None and result["parse_failure"]
    raw = result["raw_response"]
    assert "Actual output only." in raw and "[TRUNCATED]" in raw
    assert len(raw) <= 2048 and "[REDACTED" in raw
    for secret in ["fake-secret", "fake-api-secret", "fake-cookie-secret", "another-fake-secret",
                   "sk-fake-key", "fake-inline-token", "fake-user", "fake-password", "offline-test-only"]:
        assert secret not in raw
    assert "Original stem" not in raw and "messages" not in raw and "api_base" not in raw
    assert len(lm.history) == 1


def test_question_parse_failure_exposes_same_safe_completion(monkeypatch):
    lm = install_lm(monkeypatch, [{"unrelated": "Actual question completion\npassword=fake-secret\n" + "x" * 3000}])
    with pytest.raises(generator.GenerationOutputError) as captured:
        generator.generate_question("Scope", "Docs")
    raw = captured.value.raw_response
    assert "Actual question completion" in raw and "fake-secret" not in raw
    assert len(raw) <= 2048 and "[TRUNCATED]" in raw
    assert "password" not in str(captured.value)
    assert len(lm.history) == 1


def test_transport_failures_never_dump_provider_exception_or_retry(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-test-only")
    class FailingLM(DummyLM):
        def __init__(self):
            super().__init__([])
            self.call_count = 0

        def __call__(self, *args, **kwargs):
            self.call_count += 1
            raise RuntimeError("Authorization: Bearer fake-provider-secret")

    lm = FailingLM()
    monkeypatch.setattr(generator.dspy, "LM", lambda **kwargs: lm)
    result = generator.cite_question(vars(output()), [source()], "offline/model")
    assert result == {"evidence": None, "parse_failure": "Citation request failed"}
    assert "fake-provider-secret" not in str(result)
    assert lm.call_count == 1
    with pytest.raises(RuntimeError, match="Question generation request failed") as captured:
        generator.generate_question("Scope", "Docs")
    assert "fake-provider-secret" not in str(captured.value)
    assert lm.call_count == 2


def test_parse_accepts_field_marker_glued_to_previous_line():
    # Real Gemini 3.8 Flash output put "[[ ## stem ## ]]" right after the reasoning text.
    fields = ["reasoning", *generator.QUESTION_FIELDS]
    completion = "[[ ## reasoning ## ]]\nWhy.[[ ## stem ## ]]\nWhat should you do?\n\n" + "".join(
        f"[[ ## {name} ## ]]\n{name} text\n\n" for name in fields[2:]) + "[[ ## completed ## ]]\n"
    signature = generator.dspy.ChainOfThought(generator.PmleQuestionSignature).predict.signature
    parsed = generator.CompletionCaptureAdapter().parse(signature, completion)
    assert parsed["reasoning"] == "Why."
    assert parsed["stem"] == "What should you do?"
