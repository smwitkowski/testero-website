"""Real Codex generation/citation and Claude auth-failure replays; no live calls."""
import json
from pathlib import Path
import pytest
from shared.cli_models import CLIExitError, CLIAuthError, parse_claude_output
from shared.quality_gate import QuestionQualitySignature

FIXTURES = Path(__file__).parent / "fixtures/cli_models"


def test_real_claude_expired_oauth_fails_without_structured_verdict():
    text = (FIXTURES / "judge-output.json").read_text()
    data = json.loads(text)
    assert data["is_error"] is True
    assert data["result"] == "Failed to authenticate: OAuth session expired and could not be refreshed"
    assert "structured_output" not in data
    with pytest.raises(CLIAuthError):
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
                                 model="codex/gpt-6-astra", exam_subsection=scope["subsection"])
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
    citation = cite_question(question, context["sources"], model="codex/gpt-6-astra")
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



HISTORICAL_CLAUDE_SIGNATURE = QuestionQualitySignature.delete("distractors_need_knowledge")


def test_real_logged_in_claude_historical_schema_and_current_missing_check_rejection(monkeypatch,tmp_path):
    from shared.quality_gate import STYLE_CHECKS, judge_question
    context=json.loads((FIXTURES/"judge-logged-in-context.json").read_text())
    raw=(FIXTURES/"judge-logged-in-output.json").read_text()
    parsed=cli_models.parse_claude_output(raw,HISTORICAL_CLAUDE_SIGNATURE)
    assert set(parsed)==set(HISTORICAL_CLAUDE_SIGNATURE.output_fields)
    assert {name:parsed[name] for name in STYLE_CHECKS} == {name:False for name in STYLE_CHECKS}
    assert parsed["verdict"]=="FAIL" and parsed["score"]==.5
    assert "distractors_need_knowledge" not in parsed
    with pytest.raises(cli_models.CLISchemaError):
        cli_models.parse_claude_output(raw,QuestionQualitySignature)
    monkeypatch.setattr(cli_models,"CLI_TEMP_ROOT",tmp_path)
    calls=[]
    def replay(command,**kwargs):
        calls.append(command)
        assert "distractors_need_knowledge" in json.loads(command[command.index("--json-schema")+1])["required"]
        return CompletedProcess(command,0,raw,"")
    monkeypatch.setattr(cli_models.subprocess,"run",replay)
    inputs=context["inputs"]
    result=judge_question(inputs["question_data"],inputs["domain_context"],documentation_context=inputs["documentation_context"],
                          option_evidence=inputs["option_evidence"],model="claude",generator_model="codex")
    assert not result.passed and result.score==0 and result.error_class=="CLISchemaError"
    assert len(calls)==1


def test_real_exported_claude_request_is_historical_and_cannot_bypass_new_check(monkeypatch,tmp_path):
    from shared.quality_gate import STYLE_CHECKS, judge_question
    from types import SimpleNamespace
    request=json.loads((FIXTURES/"judge-exported-request.json").read_text())
    raw=(FIXTURES/"judge-exported-output.json").read_text()
    expected=json.loads((FIXTURES/"judge-exported-verdict.json").read_text())
    assert cli_models.parse_claude_output(raw,HISTORICAL_CLAUDE_SIGNATURE)==expected
    assert expected["verdict"]=="UNCERTAIN" and expected["score"]==.74
    assert all(expected[name] is True for name in STYLE_CHECKS)
    assert "distractors_need_knowledge" not in expected
    calls=[]
    monkeypatch.setattr(cli_models.subprocess,"run",lambda *args,**kwargs:calls.append(args))
    with pytest.raises(cli_models.CLISchemaError):
        cli_models.run_claude_request("claude",request["judge_prompt"],request["verdict_schema"])
    assert calls==[]
    context=recorded_context()
    question=json.loads((FIXTURES/"generation-output.json").read_text())
    result=judge_question(question,context["scope"]["domain_prompt"],documentation_context="Recorded evidence excerpts",
                         model="claude",generator_model="codex/gpt-6-astra",predictor=lambda **_:SimpleNamespace(**expected))
    assert not result.passed and result.score==0


def test_real_historical_claude_request_records_schema_failure_not_verdict(monkeypatch,tmp_path):
    from scripts import judge_requests as runner
    request=json.loads((FIXTURES/"judge-exported-request.json").read_text())
    requests=tmp_path/"requests"; requests.mkdir()
    verdicts=tmp_path/"verdicts"
    (requests/(request["candidate_id"]+".json")).write_text(json.dumps(request,ensure_ascii=False))
    calls=[]
    monkeypatch.setattr(cli_models.subprocess,"run",lambda *args,**kwargs:calls.append(args))
    result=runner.run_requests(requests,verdicts,parallel=1)
    assert result.completed==0 and result.failed==1
    assert calls==[] and not (verdicts/(request["candidate_id"]+".json")).exists()
    failure=json.loads((verdicts/".failures"/(request["candidate_id"]+".json")).read_text())
    assert failure["error_class"]=="RequestValidationError"
