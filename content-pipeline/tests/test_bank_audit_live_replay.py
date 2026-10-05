"""Replay the real 0/10 bank smoke; no new semantic PASS is fabricated."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from unittest.mock import Mock

from dspy.utils import DummyLM
import pytest

from shared import bank_grounding as bank
from shared import llm_generator
from shared.doc_search import documentation_context
from shared.evidence import check_evidence
from shared.quality_gate import JudgeVerdict

FIXTURE = json.loads((Path(__file__).parent / "fixtures/bank_audit_live_replay.json").read_text())
CASES = FIXTURE["cases"]
HEALTHY_CITATIONS = [c for c in CASES if not c["question_id"].startswith("bc566ee0")]


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(",", ":")).encode()).hexdigest()


@pytest.mark.parametrize("case", HEALTHY_CITATIONS, ids=lambda c: c["question_id"][:8])
def test_live_true_defect_and_retrieval_miss_still_fail_with_recorded_docs(monkeypatch, case):
    recorded = case["recorded"]
    question = recorded["question"]
    before = deepcopy(case)
    search = Mock(return_value=deepcopy(recorded["sources"]))
    monkeypatch.setattr(bank, "search_objective_docs", search)
    lm = DummyLM([{"evidence": attempt["evidence"]} for attempt in recorded["citation_attempts"]])
    factory = Mock(return_value=lm)
    monkeypatch.setattr(llm_generator, "_generation_lm", factory)
    judge = Mock(return_value=JudgeVerdict(**recorded["judge_verdict"]))
    monkeypatch.setattr(bank, "judge_question", judge)
    result = bank.check_existing_question(deepcopy(question), deepcopy(case["scope"]))
    assert result["schema_check"] == recorded["schema_check"]
    assert result["mechanical_check"] == recorded["mechanical_check"] == {"passed": True, "errors": []}
    assert result["judge_verdict"] == recorded["judge_verdict"]
    assert not result["passed"] and result["reasons"] == [recorded["judge_verdict"]["reason"]]
    assert result["question"] == question and case == before
    query, services = search.call_args.args
    assert query.startswith("Marked answer: " + question["correct_answer"])
    assert question["stem"] in query and question["correct_answer"] in query
    assert query.endswith(case["scope"]["objective_text"])
    assert query.index("Secondary exam scope hint") > query.index(question["stem"])
    assert services == result["retrieval"]["key_services"]
    relevance = judge.call_args.args[1]
    assert "ANY objective" in relevance and "must not fail scenario_relevant" in relevance
    assert "standard:1.1:1" in relevance and "standard:6.2:3" in relevance
    assert relevance != case["scope"]["objective_text"]
    assert result["objective_mapping"]["objective_id"] == recorded["objective_id"]
    assert result["objective_mapping"]["used_as"] == "secondary retrieval hint, not relevance gate"
    assert result["relevance_scope"]["kind"] == "exam_blueprint"
    assert judge.call_args.kwargs["max_tokens"] == bank.AUDIT_JUDGE_MAX_TOKENS == 4000
    assert factory.call_args.kwargs["max_tokens"] == bank.AUDIT_CITATION_MAX_TOKENS == 16000
    if case["question_id"].startswith("9783e3d9"):
        assert question["distractor_1_explanation"].endswith("larger re")
        assert "truncated mid-sentence" in result["reasons"][0]
    else:
        assert "MATRIX_FACTORIZATION" in query and "BigQuery ML" in services
        # The old frozen docs still lack necessary facts. Changing the query must
        # not retroactively turn missing evidence into a PASS.
        assert "never mention matrix factorization" in result["reasons"][0]


def test_live_fixture_provenance_full_sources_and_partial_completion():
    assert {c["question_id"][:8] for c in CASES} == {"9783e3d9", "0f701a7e", "bc566ee0"}
    for case in CASES:
        assert canonical_hash(case["recorded"]) == case["record_sha256"]
        assert check_evidence(case["recorded"]["evidence"], case["recorded"]["sources"])["passed"]
        assert documentation_context(case["recorded"]["sources"])
        assert not case["recorded"]["passed"]
    partial = next(c for c in CASES if c["question_id"].startswith("bc566ee0"))["recorded"]["citation_attempts"][0]
    assert partial["evidence"] is None and not partial["mechanical_check"]["passed"]
    assert partial["parse_failure"] == "Citation output could not be parsed"
    assert partial["raw_response"].endswith("only accepts one")
    assert "not recorded" in FIXTURE["provenance"]["truncation_metadata"]
    original = Path(__file__).parents[1] / FIXTURE["provenance"]["artifact"]
    # Operator re-runs overwrite this ignored path. Check the original only when
    # its hash matches the frozen first-run fixture; fixtures remain portable.
    if original.exists() and hashlib.sha256(original.read_bytes()).hexdigest() == FIXTURE["provenance"]["artifact_sha256"]:
        by_id = {r["question_id"]: r for r in json.loads(original.read_text())["results"]}
        assert all(by_id[c["question_id"]] == c["recorded"] for c in CASES)


def test_question_services_not_lexical_services_and_missing_mapping_is_allowed(monkeypatch):
    case = next(c for c in CASES if c["question_id"].startswith("0f701a7e"))
    question = case["recorded"]["question"]
    scope = {"cert_id": case["scope"]["cert_id"], "guide_sha256": case["scope"]["guide_sha256"]}
    search = Mock(return_value=[])
    monkeypatch.setattr(bank, "search_objective_docs", search)
    result = bank.check_existing_question(question, scope)
    assert search.call_count == 1
    query, services = search.call_args.args
    assert "MATRIX_FACTORIZATION" in query and "BigQuery ML" in services
    assert "Secondary exam scope hint" not in query
    assert result["objective_mapping"]["objective_id"] is None
    assert not result["passed"]  # Empty docs never pass, with or without mapping.


def test_citation_truncation_is_recorded_and_never_judged(monkeypatch):
    case = next(c for c in CASES if c["question_id"].startswith("0f701a7e"))
    sources = case["recorded"]["sources"]
    monkeypatch.setattr(bank, "search_objective_docs", Mock(return_value=sources))
    # Fault injection at the production citation boundary; native LM metadata is
    # tested separately. Even usable receipts cannot hide an explicit truncation.
    citation = Mock(return_value={"evidence": case["recorded"]["evidence"],
                                 "error_class": "MaxTokensTruncation",
                                 "parse_failure": "LM completion exceeded max_tokens"})
    monkeypatch.setattr(bank, "cite_question", citation)
    judge = Mock()
    monkeypatch.setattr(bank, "judge_question", judge)
    result = bank.check_existing_question(case["recorded"]["question"], case["scope"])
    assert not result["passed"] and not result["mechanical_check"]["passed"]
    assert result["error_class"] == "MaxTokensTruncation"
    assert citation.call_count == 1
    assert result["citation_attempts"][0]["error_class"] == "MaxTokensTruncation"
    judge.assert_not_called()


def test_judge_truncation_is_explicit_on_row_and_never_passes(monkeypatch):
    case = HEALTHY_CITATIONS[0]
    recorded = case["recorded"]
    monkeypatch.setattr(bank, "search_objective_docs", Mock(return_value=recorded["sources"]))
    monkeypatch.setattr(bank, "cite_question", Mock(return_value={"evidence": recorded["evidence"]}))
    monkeypatch.setattr(bank, "judge_question", Mock(return_value=JudgeVerdict(
        False, 0.0, "LM completion reached its token limit", bank.DEFAULT_JUDGE_MODEL,
        error_class="MaxTokensTruncation")))
    result = bank.check_existing_question(recorded["question"], case["scope"])
    assert result["mechanical_check"]["passed"] and not result["passed"]
    assert result["error_class"] == result["judge_verdict"]["error_class"] == "MaxTokensTruncation"


def test_token_limit_is_terminal_even_if_later_valid_receipts_are_available(monkeypatch):
    case = next(c for c in CASES if c["question_id"].startswith("9783e3d9"))
    recorded = case["recorded"]
    monkeypatch.setattr(bank, "search_objective_docs", Mock(return_value=recorded["sources"]))
    citation = Mock(side_effect=[
        {"evidence": None, "parse_failure": "LM completion reached its token limit", "error_class": "MaxTokensTruncation"},
        {"evidence": recorded["evidence"]},
    ])
    monkeypatch.setattr(bank, "cite_question", citation)
    judge = Mock(return_value=JudgeVerdict(**recorded["judge_verdict"]))
    monkeypatch.setattr(bank, "judge_question", judge)
    result = bank.check_existing_question(recorded["question"], case["scope"])
    assert [a["mechanical_check"]["passed"] for a in result["citation_attempts"]] == [False]
    assert result["error_class"] == result["citation_attempts"][0]["error_class"] == "MaxTokensTruncation"
    assert citation.call_count == 1
    judge.assert_not_called()
    assert not result["passed"] and "token limit" in result["reasons"][0]
