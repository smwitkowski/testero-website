"""Offline bank audit replay of real generated candidates, not exam samples.

Only reduced JudgeVerdict outputs exist in the source artifacts. Replay them at
that boundary; do not invent the seven unrecorded rubric booleans. Citation
replay uses the actual DSPy signature/parser/checker against full frozen text.
"""
import ast
from copy import deepcopy
from dataclasses import asdict
import hashlib
import importlib
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from dspy.utils import DummyLM
import pytest

from shared import bank_grounding as bank
from shared import llm_generator
from shared.doc_search import documentation_context
from shared.evidence import check_evidence
from shared.quality_gate import JudgeVerdict

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "bank_grounding_replay.json"
FIXTURE = json.loads(FIXTURE_PATH.read_text())
CASES = FIXTURE["cases"]


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(",", ":")).encode()).hexdigest()


def install_replay(monkeypatch, case, receipts=None):
    search = Mock(return_value=deepcopy(case["sources"]))
    monkeypatch.setattr(bank, "search_objective_docs", search)
    # Inject the LM factory, not credentials. No API key or environment loading.
    lm = DummyLM(receipts or [{"evidence": a["evidence"]} for a in case["citation_attempts"]])
    monkeypatch.setattr(llm_generator, "_generation_lm", Mock(return_value=lm))
    judge = Mock(return_value=JudgeVerdict(**case["judge_verdict"]))
    monkeypatch.setattr(bank, "judge_question", judge)
    return lm, search, judge


def run(case, question=None, scope=None, **kwargs):
    return bank.check_existing_question(
        deepcopy(case["question"]) if question is None else question,
        deepcopy(case["scope"]) if scope is None else scope,
        model=kwargs.pop("model", case["model"]),
        judge_model=kwargs.pop("judge_model", case["judge_model"]), **kwargs,
    )


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["name"])
def test_real_accepted_and_rejected_replay(monkeypatch, case):
    lm, search, judge = install_replay(monkeypatch, case)
    result = run(case)
    assert result["passed"] is case["accepted"]
    assert result["question"] == case["question"]
    if case["name"] == "pmle-pilot-6d-candidate-3":
        # This real recorded stem is unchanged. The new checklist gate now stops
        # it before retrieval; do not manufacture a new judge output or sources.
        assert not case["accepted"] and not result["schema_check"]["passed"]
        assert any("requirements checklist" in error for error in result["schema_check"]["errors"])
        assert result["sources"] == [] and result["citation_attempts"] == []
        assert result["judge_verdict"]["reason"] == "Not judged"
        search.assert_not_called()
        judge.assert_not_called()
        assert lm.history == []
        return
    assert result["sources"] == case["sources"]
    assert result["schema_check"] == case["schema_check"]
    assert result["mechanical_check"] == case["mechanical_check"] == {"passed": True, "errors": []}
    assert result["citation_attempts"] == case["citation_attempts"]
    assert result["evidence"] == case["evidence"]
    assert result["judge_verdict"] == case["judge_verdict"]
    assert result["reasons"] == ([] if case["accepted"] else [case["judge_verdict"]["reason"]])
    assert len(lm.history) == len(case["citation_attempts"])
    retrieval = bank.question_retrieval(case["question"], case["scope"]["objective_text"])
    search.assert_called_once_with(retrieval["query"], retrieval["key_services"])
    blueprint = bank.load_cert_context(case["scope"]["cert_id"])
    judge.assert_called_once_with(case["question"], bank.exam_blueprint_context(blueprint),
        documentation_context=documentation_context(case["sources"]),
        model=case["judge_model"], generator_model=case["model"], option_evidence=case["evidence"],
        max_tokens=bank.AUDIT_JUDGE_MAX_TOKENS)
    prompt = lm.history[0]["messages"][-1]["content"]
    for value in case["question"].values():
        # Question is JSON inside the DSPy input, so use its escaped string body.
        assert json.dumps(value, ensure_ascii=False)[1:-1] in prompt


def test_fixture_provenance_and_frozen_inputs():
    assert len(CASES) == 4
    for artifact in ("pmle-pilot-6d.json", "ace-pilot-4d.json"):
        selected = [case for case in CASES if case["provenance"]["artifact"].endswith(artifact)]
        assert {case["accepted"] for case in selected} == {True, False}
    for case in CASES:
        provenance = case["provenance"]
        assert canonical_hash(case["question"]) == provenance["question_sha256"]
        assert canonical_hash(case["scope"]) == provenance["scope_sha256"]
        assert canonical_hash(case["sources"]) == provenance["source_records_sha256"]
        assert set(case["judge_verdict"]) == {"passed", "score", "reason", "model"}
        assert check_evidence(case["citation_attempts"][-1]["evidence"], case["sources"])["passed"]
        assert documentation_context(case["sources"])
        for key in ("artifact_sha256", "candidate_sha256"):
            assert len(provenance[key]) == 64
        # Artifacts are ignored, not required in fresh checkout. Verify when present.
        original = Path(__file__).parents[1] / provenance["artifact"]
        if original.exists():
            assert hashlib.sha256(original.read_bytes()).hexdigest() == provenance["artifact_sha256"]
            candidate = json.loads(original.read_text())["candidates"][provenance["candidate_offset"]]
            assert canonical_hash(candidate) == provenance["candidate_sha256"]
            assert candidate["judge_verdict"] == case["judge_verdict"]
            assert candidate["sources"] == case["sources"]
            assert candidate["stem"] == case["question"]["stem"]
            assert candidate["key"] == "A"
            assert [o["text"] for o in candidate["options"]] == [case["question"][f] for f in llm_generator.QUESTION_FIELDS[1:5]]


@pytest.mark.parametrize("eventual_pass", [True, False])
def test_real_citation_retries_once_without_regeneration(monkeypatch, eventual_pass):
    case = CASES[0]
    good = deepcopy(case["citation_attempts"][0]["evidence"])
    bad = deepcopy(good)
    bad[0]["quote"] = "This sentence is absent from the recorded fetched source."
    lm, _, judge = install_replay(monkeypatch, case, [{"evidence": bad}, {"evidence": good if eventual_pass else bad}])
    forbidden = Mock(side_effect=AssertionError("Question generation is forbidden"))
    monkeypatch.setattr(llm_generator, "generate_question", forbidden)
    result = run(case)
    assert result["passed"] is eventual_pass
    assert len(lm.history) == len(result["citation_attempts"]) == 2
    assert [a["mechanical_check"]["passed"] for a in result["citation_attempts"]] == [False, eventual_pass]
    assert result["citation_attempts"][0]["mechanical_check"]["errors"][0] in lm.history[1]["messages"][-1]["content"]
    assert result["question"] == case["question"]
    forbidden.assert_not_called()
    assert judge.call_count == int(eventual_pass)


@pytest.mark.parametrize("model,judge_model", [
    (bank.DEFAULT_GENERATOR_MODEL, "openrouter/google/gemini-2.5-flash"),
    ("unknown/custom", bank.DEFAULT_JUDGE_MODEL),
    (bank.DEFAULT_GENERATOR_MODEL, "unknown/custom"),
])
def test_model_policy_precedes_all_services(monkeypatch, model, judge_model):
    services = [Mock(side_effect=AssertionError("Must not call")) for _ in range(4)]
    for name, service in zip(("search_objective_docs", "cite_question", "validate_question", "judge_question"), services):
        monkeypatch.setattr(bank, name, service)
    result = run(CASES[0], model=model, judge_model=judge_model)
    assert not result["passed"] and result["reasons"] == ["Model policy failed"]
    for service in services:
        service.assert_not_called()


@pytest.mark.parametrize("defect", ["missing", "type", "duplicate", "extra", "scope", "guide_hash"])
def test_bad_input_fails_before_retrieval(monkeypatch, defect):
    case = CASES[0]
    q, scope = deepcopy(case["question"]), deepcopy(case["scope"])
    if defect == "missing": del q["correct_explanation"]
    elif defect == "type": q["stem"] = None
    elif defect == "duplicate": q["distractor_1"] = q["correct_answer"]
    elif defect == "extra": q["evidence"] = []
    elif defect == "scope": scope["objective_text"] = None
    else: scope["guide_sha256"] = "not-a-guide-hash"
    search = Mock()
    monkeypatch.setattr(bank, "search_objective_docs", search)
    result = run(case, question=q, scope=scope)
    assert not result["passed"] and result["reasons"]
    assert result["question"] == q
    search.assert_not_called()


@pytest.mark.parametrize("service,stage", [
    ("search_objective_docs", "Documentation retrieval"),
    ("documentation_context", "Documentation validation"),
    ("validate_question", "Schema validation"),
    ("cite_question", "Citation request"),
    ("check_evidence", "Mechanical evidence check"),
    ("judge_question", "Independent judge"),
])
def test_transport_exception_bodies_never_enter_results(monkeypatch, service, stage):
    install_replay(monkeypatch, CASES[0])
    monkeypatch.setattr(bank, service, Mock(side_effect=RuntimeError("PRIVATE provider payload Authorization: Bearer secret")))
    result = run(CASES[0])
    assert not result["passed"] and result["reasons"] == [stage + " failed"]
    assert "PRIVATE" not in json.dumps(result)
    assert "secret" not in json.dumps(result)


@pytest.mark.parametrize("defect", ["empty", "hash", "missing_text"])
def test_invalid_fetched_sources_never_reach_citation_or_judge(monkeypatch, defect):
    case = CASES[0]
    _, search, judge = install_replay(monkeypatch, case)
    sources = deepcopy(case["sources"])
    if defect == "empty": sources = []
    elif defect == "hash": sources[0]["text_sha256"] = "0" * 64
    else: del sources[0]["text"]
    search.return_value = sources
    citation = Mock()
    monkeypatch.setattr(bank, "cite_question", citation)
    result = run(case)
    assert not result["passed"] and result["reasons"] == ["Documentation validation failed"]
    citation.assert_not_called()
    judge.assert_not_called()


def test_input_immutability_exact_text_and_no_file_writes(monkeypatch):
    import builtins
    import dotenv
    case = CASES[0]
    _, _, judge = install_replay(monkeypatch, case)
    q, scope = deepcopy(case["question"]), deepcopy(case["scope"])
    q["stem"] = "  " + q["stem"] + "  "
    q["correct_answer"] = "**" + q["correct_answer"] + "**"
    before = deepcopy((q, scope))
    real_open = builtins.open
    def read_only(file, mode="r", *args, **kwargs):
        assert not any(flag in mode for flag in ("w", "a", "+", "x")), "No writes"
        return real_open(file, mode, *args, **kwargs)
    monkeypatch.setattr(builtins, "open", read_only)
    no_write = Mock(side_effect=AssertionError("No writes or env loading"))
    monkeypatch.setattr(Path, "write_text", no_write)
    monkeypatch.setattr(Path, "write_bytes", no_write)
    monkeypatch.setattr(dotenv, "load_dotenv", no_write)
    result = run(case, question=q, scope=scope)
    assert result["passed"] and result["question"] == q == before[0]
    assert scope == before[1] and judge.call_args.args[0] == q
    result["question"]["stem"] = "changed returned copy"
    assert q == before[0]
    no_write.assert_not_called()


def test_import_has_no_database_environment_or_generation_calls(monkeypatch):
    import dotenv
    no_env = Mock(side_effect=AssertionError("No env loading"))
    monkeypatch.setattr(dotenv, "load_dotenv", no_env)
    importlib.reload(bank)
    no_env.assert_not_called()
    tree = ast.parse(Path(bank.__file__).read_text())
    imports = [node.module or "" for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)]
    assert not any("supabase" in name or "dotenv" in name or "text_utils" in name for name in imports)
    calls = {node.func.id for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)}
    assert not calls.intersection({"generate_question", "clean_question", "database_client", "load_dotenv"})


@pytest.mark.parametrize("verdict", [SimpleNamespace(passed=True), JudgeVerdict(True, 0.9, "Wrong model", "openrouter/openai/gpt-4o")])
def test_malformed_or_wrong_model_judge_verdict_fails_closed(monkeypatch, verdict):
    _, _, judge = install_replay(monkeypatch, CASES[0])
    judge.return_value = verdict
    result = run(CASES[0])
    assert result["mechanical_check"]["passed"] and not result["passed"]
    assert result["reasons"]


def test_failed_judge_diagnostics_are_retained_by_read_only_audit(monkeypatch):
    case = CASES[0]
    _, _, judge = install_replay(monkeypatch, case)
    diagnostics = {"raw_response": "Actual failed judge completion " + "z" * 9000,
                   "finish_reason": "stop", "usage": {"completion_tokens": 100}}
    judge.return_value = JudgeVerdict(False, 0.0, "Judge failed or returned invalid output",
                                     case["judge_model"], diagnostics=diagnostics)
    result = run(case)
    assert not result["passed"]
    assert result["judge_verdict"]["diagnostics"] == diagnostics
    assert "diagnostics" not in json.loads(judge.return_value.to_review_notes())["content_pipeline_judge"]


def test_failed_citation_diagnostics_remain_complete_in_read_only_audit(monkeypatch):
    case = CASES[0]
    _, _, judge = install_replay(monkeypatch, case)
    diagnostics = {"raw_response": "Actual failed citation completion " + "z" * 9000,
                   "finish_reason": "stop", "usage": {"completion_tokens": 100}}
    monkeypatch.setattr(bank, "cite_question", lambda *args, **kwargs: {
        "evidence": None, "parse_failure": "Citation output could not be parsed",
        "raw_response": diagnostics["raw_response"], "diagnostics": diagnostics})
    result = run(case)
    assert not result["passed"] and len(result["citation_attempts"]) == 2
    assert all(attempt["diagnostics"] == diagnostics for attempt in result["citation_attempts"])
    assert all(attempt["raw_response"] == diagnostics["raw_response"] for attempt in result["citation_attempts"])
    judge.assert_not_called()
