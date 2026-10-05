"""Offline transport contracts: tests never launch subscription CLIs."""
import json
from pathlib import Path
from subprocess import CompletedProcess, TimeoutExpired
from types import SimpleNamespace

import pytest

from shared import cli_models as cli
from shared.llm_generator import PmleQuestionSignature, CitationSignature, generate_question, cite_question
from shared.model_policy import DEFAULT_JUDGE_MODEL, OPENROUTER_JUDGE_MODEL, model_family, require_independent_models
from shared.quality_gate import ACCURACY_CHECKS, QuestionQualitySignature, judge_question


def question():
    return {name: "Some nonempty original text" for name in PmleQuestionSignature.output_fields}


def verdict(**changes):
    return {"verdict":"PASS", "score":0.9, "reason":"All checks met", **{k:True for k in ACCURACY_CHECKS}, **changes}


@pytest.mark.parametrize("model,family", [("codex","openai"),("codex/gpt-6.1-sol","openai"),("claude","anthropic"),("claude/claude-sonnet-5-5","anthropic"),(OPENROUTER_JUDGE_MODEL,"anthropic")])
def test_subscription_families(model,family):
    assert model_family(model) == family
    assert DEFAULT_JUDGE_MODEL == "claude"
    assert require_independent_models("codex", "claude") == ("openai", "anthropic")


@pytest.mark.parametrize("pair",[("codex","openrouter/openai/gpt-4o"),("openrouter/anthropic/claude-sonnet-5.5","claude"),("codex/","claude"),("codex/anthropic/claude","claude")])
def test_unknown_or_same_vendor_rejected(pair):
    with pytest.raises(ValueError): require_independent_models(*pair)


@pytest.mark.parametrize("signature",[PmleQuestionSignature,CitationSignature,QuestionQualitySignature])
def test_output_schema_required_typed_and_closed(signature):
    schema = cli.output_model(signature).model_json_schema()
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == set(signature.output_fields)
    if signature is CitationSignature:
        assert schema["$defs"]["StrictOptionEvidence"]["additionalProperties"] is False
    if signature is QuestionQualitySignature:
        for name in ACCURACY_CHECKS: assert schema["properties"][name]["type"] == "boolean"


def inputs():
    return {"domain_context":"A real objective", "documentation_context":"Frozen official source text", "difficulty":"MEDIUM", "exam_subsection":"1.1", "gap_analysis_guidance":""}


@pytest.mark.parametrize("model",["codex", "codex/gpt-6.1-sol"])
def test_codex_command_schema_stdin_empty_cwd_and_cleanup(monkeypatch,tmp_path,model):
    monkeypatch.setattr(cli,"CLI_TEMP_ROOT",tmp_path)
    monkeypatch.setenv("OPENAI_API_KEY","secret-must-not-reach-child")
    seen = {}
    def fake(command,**kwargs):
        cwd = Path(kwargs["cwd"])
        seen["cwd"] = cwd
        assert list(cwd.iterdir()) == []
        assert command[:2] == ["codex","exec"]
        assert "--ephemeral" in command and "--skip-git-repo-check" in command
        assert command[command.index("--sandbox")+1] == "read-only"
        schema = json.loads(Path(command[command.index("--output-schema")+1]).read_text())
        assert set(schema["required"]) == set(question())
        assert "S1 Business first" in kwargs["input"]
        assert "Frozen official source text" in kwargs["input"]
        assert "OPENAI_API_KEY" not in kwargs["env"]
        assert kwargs["timeout"] == 10
        assert kwargs["capture_output"] and kwargs["text"] and not kwargs["check"]
        assert command[command.index("-m") + 1] == "gpt-6.1-sol"
        assert "--ignore-user-config" in command and "--ignore-rules" in command
        assert "project_doc_max_bytes=0" in command and 'web_search="disabled"' in command
        disabled = [command[i + 1] for i, value in enumerate(command) if value == "--disable"]
        assert set(disabled) == set(cli.CODEX_DISABLED_FEATURES)
        assert {"shell_tool", "unified_exec", "hooks", "multi_agent", "plugins", "apps"} <= set(disabled)
        Path(command[command.index("-o")+1]).write_text(json.dumps(question()))
        return CompletedProcess(command,0,"not parsed as question","private stderr not retained")
    monkeypatch.setattr(cli.subprocess,"run",fake)
    assert cli.run_signature(model,PmleQuestionSignature,inputs(),timeout=10) == question()
    assert not seen["cwd"].exists()
    assert list(tmp_path.iterdir()) == []


def test_claude_command_no_tools_no_persistence_and_structured_envelope(monkeypatch,tmp_path):
    monkeypatch.setattr(cli,"CLI_TEMP_ROOT",tmp_path)
    monkeypatch.setenv("ANTHROPIC_API_KEY","secret")
    for name in ("CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "ANTHROPIC_BASE_URL"):
        monkeypatch.setenv(name, "external-provider")
    def fake(command,**kwargs):
        assert Path(command[0]).name == "claude" and "-p" in command
        assert command[command.index("--model")+1] == "claude-sonnet-5-5"
        assert command[command.index("--tools")+1] == ""
        assert "--no-session-persistence" in command and "--safe-mode" in command
        assert "--strict-mcp-config" in command
        assert command[command.index("--mcp-config")+1] == '{"mcpServers":{}}'
        assert "ANTHROPIC_API_KEY" not in kwargs["env"]
        for name in ("CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "ANTHROPIC_BASE_URL"):
            assert name not in kwargs["env"]
        assert list(Path(kwargs["cwd"]).iterdir()) == []
        return CompletedProcess(command,0,json.dumps({"type":"result","subtype":"success","is_error":False,"structured_output":verdict()}),"")
    monkeypatch.setattr(cli.subprocess,"run",fake)
    data=cli.run_signature("claude",QuestionQualitySignature,{"question_data":question(),"domain_context":"scope","documentation_context":"docs","option_evidence":[]})
    assert data == verdict()


@pytest.mark.parametrize("model",["codex","claude"])
@pytest.mark.parametrize("failure,error",[("exit",cli.CLIExitError),("usage",cli.CLIUsageLimitError),("timeout",cli.CLITimeoutError),("missing",cli.CLISchemaError),("shape",cli.CLISchemaError),("cannot_start",cli.CLIExitError)])
def test_cli_failures_explicit_safe_and_temp_cleanup(monkeypatch,tmp_path,model,failure,error):
    monkeypatch.setattr(cli,"CLI_TEMP_ROOT",tmp_path)
    def fake(command,**kwargs):
        if failure == "timeout": raise TimeoutExpired(command,1,output="SECRET transport body")
        if failure == "cannot_start": raise OSError("SECRET local environment")
        if failure in {"exit","usage"}: return CompletedProcess(command,1,"", "You've hit your limit" if failure=="usage" else "SECRET transport body")
        if model == "codex":
            if failure == "shape": Path(command[command.index("-o")+1]).write_text('{"stem":99}')
            return CompletedProcess(command,0,"","")
        return CompletedProcess(command,0,json.dumps({"type":"result","is_error":False,"subtype":"success",**({"structured_output":{"stem":99}} if failure=="shape" else {})}),"")
    monkeypatch.setattr(cli.subprocess,"run",fake)
    with pytest.raises(error) as caught: cli.run_signature(model,PmleQuestionSignature,inputs())
    assert "SECRET" not in str(caught.value)
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("text",['{"stem":"x","stem":"y"}', '{"score":NaN}', '{"stem":null}'])
def test_strict_json_rejects_duplicate_nonfinite_null(text):
    with pytest.raises(cli.CLISchemaError): cli.parse_output(text,PmleQuestionSignature)


@pytest.mark.parametrize("changes",[{"business_context":"true"},{"score":"0.9"},{"extra":"x"}])
def test_no_typed_coercion_or_unknown_fields(changes):
    with pytest.raises(cli.CLISchemaError): cli.parse_output(json.dumps(verdict(**changes)),QuestionQualitySignature)


def test_no_freetext_verdict_fallback_or_error_envelope_acceptance():
    with pytest.raises(cli.CLISchemaError): cli.parse_claude_output(json.dumps({"type":"result","is_error":False,"subtype":"success","result":json.dumps(verdict())}),QuestionQualitySignature)
    with pytest.raises(cli.CLIUsageLimitError): cli.parse_claude_output(json.dumps({"is_error":True,"result":"You've hit your limit"}),QuestionQualitySignature)
    with pytest.raises(cli.CLIExitError): cli.parse_claude_output(json.dumps({"is_error":True,"structured_output":verdict()}),QuestionQualitySignature)


@pytest.mark.parametrize("failure",[cli.CLIExitError,cli.CLITimeoutError,cli.CLISchemaError])
def test_judge_cli_failure_retains_error_class(monkeypatch,failure):
    monkeypatch.setattr(cli,"run_signature",lambda *a,**k: (_ for _ in ()).throw(failure("Safe bounded error")))
    q=question(); q.update({name:name for name in ("correct_answer","distractor_1","distractor_2","distractor_3")})
    result=judge_question(q,"scope",documentation_context="docs",model="claude",generator_model="codex")
    assert not result.passed and result.score == 0 and result.error_class == failure.__name__


def test_judge_usage_error_propagates_for_batch_stop(monkeypatch):
    monkeypatch.setattr(cli,"run_signature",lambda *a,**k: (_ for _ in ()).throw(cli.CLIUsageLimitError("Batch stop")))
    q=question(); q.update({name:name for name in ("correct_answer","distractor_1","distractor_2","distractor_3")})
    with pytest.raises(cli.CLIUsageLimitError): judge_question(q,"scope",documentation_context="docs",model="claude",generator_model="codex")


def test_codex_helpers_skip_openrouter_credentials(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY",raising=False)
    calls=[]
    def fake(model,signature,inputs):
        calls.append((model,signature,inputs))
        return question() if signature is PmleQuestionSignature else {"evidence":[]}
    monkeypatch.setattr(cli,"run_signature",fake)
    data=generate_question("scope","docs",model="codex")
    assert data == question()
    assert cite_question(data,[{"url":"https://docs.cloud.google.com/real","text":"Frozen text"}],model="codex") == {"evidence":[]}
    assert [call[1] for call in calls] == [PmleQuestionSignature,CitationSignature]


@pytest.mark.parametrize("phrase", ["must satisfy the following goals", "Stakeholders have established a policy"])
def test_named_checklist_leadins_rejected_without_requirements_suffix(phrase):
    from shared.validator import _stem_style_errors
    assert any("requirements checklist" in error for error in _stem_style_errors(phrase))


@pytest.mark.parametrize("envelope", [
    {"type":"result", "subtype":"success", "is_error":"true"},
    {"type":"result", "subtype":"success", "is_error":"false"},
    {"type":"result", "subtype":"success"},
    {"type":"result", "is_error":False},
    {"subtype":"success", "is_error":False},
    {"type":"not-result", "subtype":"success", "is_error":False},
])
def test_mistyped_missing_or_nonresult_envelope_fails_closed(envelope):
    with pytest.raises((cli.CLIExitError, cli.CLISchemaError)):
        cli.parse_claude_output(json.dumps({**envelope, "structured_output":verdict()}), QuestionQualitySignature)
