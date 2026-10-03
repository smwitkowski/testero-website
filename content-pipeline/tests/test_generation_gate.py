"""Generation persistence contracts. All service and LLM calls are mocked."""
import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from click.testing import CliRunner

from scripts import generate_pmle_questions as generate
from shared.quality_gate import JudgeVerdict
from shared.supabase_client import SupabaseClient
from shared.validator import validate_question

RUN_ID = "11111111-1111-4111-8111-111111111111"
QUESTION = {
    "stem": "You are working for a company that needs to deploy a machine learning model for real-time predictions. What is the best approach?",
    "correct_answer": "Use Vertex AI Online Prediction",
    "distractor_1": "Use Vertex AI Batch Prediction",
    "distractor_2": "Use Cloud Functions",
    "distractor_3": "Use Cloud Run",
    "correct_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference with low latency. It handles scaling automatically and provides built-in monitoring.",
    "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing, not real-time inference. It processes large datasets offline.",
    "distractor_2_explanation": "Cloud Functions requires more manual setup and does not provide the same ML-specific features as Vertex AI.",
    "distractor_3_explanation": "Cloud Run requires containerization and manual scaling configuration, making it less suitable for ML inference.",
}


@pytest.mark.parametrize("requested_status", ["ACTIVE", "DRAFT", "RETIRED", None])
def test_insert_boundary_always_writes_run_linked_draft(requested_status):
    client = SupabaseClient.__new__(SupabaseClient)
    client.client = Mock()
    client.client.table.return_value.insert.return_value.execute.return_value.data = [{"id": "question"}]
    original = {"stem": "Question", "generation_run_id": RUN_ID, "status": requested_status}
    assert client.insert_question(original) == {"id": "question"}
    payload = client.client.table.return_value.insert.call_args.args[0]
    assert payload["status"] == "DRAFT"
    assert payload["generation_run_id"] == RUN_ID
    assert original["status"] == requested_status


def test_insert_requires_generation_run():
    client = SupabaseClient.__new__(SupabaseClient)
    client.client = Mock()
    with pytest.raises(ValueError, match="generation_run_id"):
        client.insert_question({"status": "ACTIVE"})
    client.client.table.assert_not_called()


@pytest.fixture
def generation(monkeypatch):
    client = Mock()
    client.get_domain_by_code.return_value = {"id": "domain"}
    client.create_generation_run.return_value = {"id": RUN_ID}
    client.get_question_stems_for_domain.return_value = []
    client.insert_question.return_value = {"id": "question"}
    client.insert_answers_batch.return_value = [{"id": str(i)} for i in range(4)]
    client.insert_explanation.return_value = {"id": "explanation"}
    client.update_question_review.return_value = True
    client.update_generation_run.return_value = {"id": RUN_ID}
    monkeypatch.setattr(generate, "SupabaseClient", lambda: client)
    result = SimpleNamespace(
        question=dict(QUESTION), documentation_context="Google Cloud documentation excerpts",
        doc_links=["https://cloud.google.com/vertex-ai/docs"], stem_embedding=None,
        validation_result=validate_question(QUESTION), factual_eval=None, is_duplicate=False, attempts=1,
    )
    program = Mock(return_value=result)
    monkeypatch.setattr(generate, "PMLEQuestionProgram", lambda **kwargs: program)
    return client, result, program


def invoke():
    return CliRunner().invoke(generate.main, [
        "--domain-code", "MONITORING_ML_SOLUTIONS", "--n-questions", "1",
        "--skip-gap-analysis", "--skip-semantic-dedup", "--skip-eval",
    ])


@pytest.mark.parametrize("passed", [True, False])
def test_judge_verdict_persisted_and_branched_even_with_skip_eval(generation, monkeypatch, passed):
    client, result, program = generation
    verdict = JudgeVerdict(passed=passed, score=0.9 if passed else 0.2, reason="Offline verdict", model="test")
    judge = Mock(return_value=verdict)
    monkeypatch.setattr(generate, "judge_question", judge)
    outcome = invoke()
    assert outcome.exit_code == 0, outcome.output
    judge.assert_called_once()
    assert judge.call_args.args[0] == QUESTION
    assert judge.call_args.kwargs["documentation_context"] == result.documentation_context
    assert program.call_args.kwargs["skip_eval"] is True
    row = client.insert_question.call_args.args[0]
    assert row["status"] == "DRAFT"
    assert row["generation_run_id"] == RUN_ID
    notes = json.loads(row["review_notes"])["content_pipeline_judge"]
    assert notes["passed"] is passed
    assert notes["score"] == verdict.score
    assert notes["reason"] == verdict.reason
    assert row["review_status"] == ("UNREVIEWED" if passed else "NEEDS_ANSWER_FIX")
    client.update_question_review.assert_called_once_with(
        "question", RUN_ID, "GOOD" if passed else "NEEDS_ANSWER_FIX", verdict.to_review_notes()
    )
    assert "ACTIVE" not in outcome.output


def test_incomplete_answer_write_never_finalizes_good(generation, monkeypatch):
    client, _, _ = generation
    monkeypatch.setattr(generate, "judge_question", lambda *a, **kw: JudgeVerdict(True, 0.9, "Pass", "test"))
    client.insert_answers_batch.return_value = []
    result = invoke()
    assert result.exit_code == 1
    assert client.insert_question.call_args.args[0]["review_status"] == "UNREVIEWED"
    client.update_question_review.assert_not_called()


def test_invalid_content_never_calls_judge_and_persists_failed_verdict(generation, monkeypatch):
    client, result, _ = generation
    result.question["stem"] = "Short"
    judge = Mock()
    monkeypatch.setattr(generate, "judge_question", judge)
    outcome = CliRunner().invoke(generate.main, [
        "--domain-code", "MONITORING_ML_SOLUTIONS", "--n-questions", "1",
        "--skip-gap-analysis", "--skip-semantic-dedup", "--insert-invalid",
    ])
    assert outcome.exit_code == 0, outcome.output
    judge.assert_not_called()
    row = client.insert_question.call_args.args[0]
    assert row["status"] == "DRAFT"
    assert row["review_status"] != "GOOD"
    assert json.loads(row["review_notes"])["content_pipeline_judge"]["passed"] is False


def test_cleaned_storage_payload_is_what_judge_scores(generation, monkeypatch):
    client, result, _ = generation
    result.question["correct_answer"] = "**A. Use Vertex AI Online Prediction**"
    judge = Mock(return_value=JudgeVerdict(True, 0.9, "Pass", "test"))
    monkeypatch.setattr(generate, "judge_question", judge)
    outcome = invoke()
    assert outcome.exit_code == 0, outcome.output
    assert judge.call_args.args[0]["correct_answer"] == "Use Vertex AI Online Prediction"
    assert client.insert_answers_batch.call_args.args[0][0]["choice_text"] == judge.call_args.args[0]["correct_answer"]


def test_review_finalization_scopes_draft_and_run():
    client = SupabaseClient.__new__(SupabaseClient)
    client.client = Mock()
    chain = client.client.table.return_value
    chain.update.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value.data = [{"id": "question"}]
    assert client.update_question_review("question", RUN_ID, "GOOD", "notes")
    assert chain.update.call_args.args[0] == {"review_status": "GOOD", "review_notes": "notes"}
    assert chain.eq.call_args_list == [
        (("id", "question"),), (("generation_run_id", RUN_ID),), (("status", "DRAFT"),),
    ]
