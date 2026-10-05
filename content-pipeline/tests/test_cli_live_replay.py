"""Real Codex generation/citation and Claude auth-failure replays; no live calls."""
import json
from pathlib import Path
import pytest
from shared.cli_models import CLIExitError, parse_claude_output
from shared.quality_gate import QuestionQualitySignature

FIXTURES = Path(__file__).parent / "fixtures/cli_models"


def test_real_claude_expired_oauth_fails_without_structured_verdict():
    text = (FIXTURES / "judge-output.json").read_text()
    data = json.loads(text)
    assert data["is_error"] is True
    assert data["result"] == "Failed to authenticate: OAuth session expired and could not be refreshed"
    assert "structured_output" not in data
    with pytest.raises(CLIExitError):
        parse_claude_output(text, QuestionQualitySignature)


from shared import cli_models
from shared.llm_generator import PmleQuestionSignature, CitationSignature, generate_question, cite_question
from shared.doc_search import documentation_context
from shared.evidence import check_evidence
from shared.validator import validate_question
from subprocess import CompletedProcess


def recorded_context():
    return json.loads((FIXTURES / "context.json").read_text())


def recorded_codex(monkeypatch, tmp_path, filename):
    monkeypatch.setattr(cli_models, "CLI_TEMP_ROOT", tmp_path)
    calls = []
    def replay(command, **kwargs):
        calls.append(command)
        assert command[:2] == ["codex", "exec"]
        assert command[command.index("-m") + 1] == "gpt-6-astra"
        assert "--ignore-user-config" in command
        assert "--ephemeral" in command
        assert list(Path(kwargs["cwd"]).iterdir()) == []
        assert kwargs["input"]
        raw = (FIXTURES / filename).read_text()
        Path(command[command.index("-o") + 1]).write_text(raw)
        return CompletedProcess(command, 0, "", "")
    monkeypatch.setattr(cli_models.subprocess, "run", replay)
    return calls


def test_real_codex_astra_generation_replays_through_transport_and_validator(monkeypatch, tmp_path):
    context = recorded_context()
    assert context["origin_artifact"] == "pmle-d025-first-30.json"
    assert context["candidate_index"] == 1
    calls = recorded_codex(monkeypatch, tmp_path, "generation-output.json")
    scope = context["scope"]
    question = generate_question(scope["domain_prompt"], documentation_context(context["sources"]),
                                 model="codex", exam_subsection=scope["subsection"])
    assert question == json.loads((FIXTURES / "generation-output.json").read_text())
    result = validate_question(question)
    assert result.is_valid, result.errors
    assert 50 <= len(question["stem"].split()) <= 110
    assert question["stem"].endswith("What should you do?")
    assert scope["scenario_moment"] == "recent deployment"
    assert len(calls) == 1
    assert list(tmp_path.iterdir()) == []



def test_real_codex_astra_citation_replays_through_transport_and_evidence_gate(monkeypatch, tmp_path):
    context = recorded_context()
    question = cli_models.parse_output((FIXTURES / "generation-output.json").read_text(), PmleQuestionSignature)
    calls = recorded_codex(monkeypatch, tmp_path, "citation-output.json")
    citation = cite_question(question, context["sources"], model="codex")
    assert citation == json.loads((FIXTURES / "citation-output.json").read_text())
    assert citation == cli_models.parse_output((FIXTURES / "citation-output.json").read_text(), CitationSignature)
    checked = check_evidence(citation["evidence"], context["sources"])
    assert checked["passed"], checked["errors"]
    assert [item["option_label"] for item in checked["options"]] == list("ABCD")
    assert all(len(item["quote"]) <= 300 for item in checked["options"])
    assert len(calls) == 1
    assert list(tmp_path.iterdir()) == []


def test_real_codex_quote_gate_still_rejects_mutated_receipts():
    context = recorded_context()
    citation = json.loads((FIXTURES / "citation-output.json").read_text())
    citation["evidence"][0]["quote"] = "This fabricated passage was not in any fetched document."
    checked = check_evidence(citation["evidence"], context["sources"])
    assert not checked["passed"]
    assert any("Option A: quote is not present" in error for error in checked["errors"])
