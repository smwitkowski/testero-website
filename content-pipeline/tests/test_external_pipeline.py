"""End-to-end offline generation -> external ingestion; verdicts are synthetic."""
import json
from pathlib import Path
from unittest.mock import Mock

from click.testing import CliRunner

from scripts import generate_pmle_questions as generate, ingest_external_verdicts as ingest
from shared.quality_gate import ACCURACY_CHECKS
from shared.external_judge import EXTERNAL_JUDGE_PROVENANCE, request_directory


def test_real_codex_content_mixed_batch_ingests_once_with_synthetic_verdict(monkeypatch, tmp_path):
    fixtures = Path(__file__).parent / "fixtures/cli_models"
    context = json.loads((fixtures / "context.json").read_text())
    question = json.loads((fixtures / "generation-output.json").read_text())
    citation = json.loads((fixtures / "citation-output.json").read_text())
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    factory_gen = Mock(side_effect=AssertionError("No DB in external generation"))
    inline = Mock(side_effect=AssertionError("No inline judge"))
    monkeypatch.setattr(generate,"database_client",factory_gen)
    monkeypatch.setattr(generate,"judge_three_gates",inline)
    monkeypatch.setattr(generate,"search_objective_docs",Mock(return_value=context["sources"]))
    monkeypatch.setattr(generate,"generate_question",Mock(return_value=question))
    monkeypatch.setattr(generate,"cite_question",Mock(return_value=citation))
    artifact = tmp_path / "mixed.json"
    run = CliRunner().invoke(generate.main,["--cert","machine-learning-engineer","--objective",context["scope"]["objective_id"],
        "--n-questions","2","--model","codex/gpt-5.6-sol","--judge-model","external","--artifact",str(artifact)])
    # First candidate awaits a judge; identical second candidate fails duplicate gate.
    assert run.exit_code == 1, run.output
    factory_gen.assert_not_called(); inline.assert_not_called()
    payload = json.loads(artifact.read_text())
    first, second = payload["candidates"]
    assert first["awaiting_external_judge"]
    assert second["failure_stage"] == "duplicate"
    assert first["candidate_id"] != second["candidate_id"]
    assert len(list(request_directory(artifact).glob("*.json"))) == 1
    verdicts = tmp_path / "verdicts"; verdicts.mkdir()
    from test_three_gates_v4 import bundle
    verdict = bundle(question)  # Synthetic three-gate outputs, not live factual proof.
    (verdicts / (first["candidate_id"] + ".json")).write_text(json.dumps(verdict))
    client = Mock()
    client.get_domain_by_code.return_value = {"id":"fake-domain"}
    client.create_generation_run.side_effect = lambda row: {"id":row["id"]}
    client.insert_question.side_effect = lambda row: {"id":row["id"]}
    client.insert_answers_batch.return_value = [{"id":str(i)} for i in range(4)]
    client.insert_explanation.return_value = {"id":"fake-explanation"}
    client.update_question_review.return_value = True
    client.update_generation_run.return_value = True
    factory = Mock(return_value=client)
    monkeypatch.setattr(ingest,"database_client",factory)
    flags = ["--artifact",str(artifact),"--verdicts",str(verdicts)]
    dry = CliRunner().invoke(ingest.main, [*flags,"--dry-run"])
    assert dry.exit_code == 1  # Rejected second candidate is reported, not ignored.
    assert "passing verdicts 1" in dry.output.lower() and "rejected 1" in dry.output.lower()
    assert "accepted/complete 0" in dry.output.lower()
    factory.assert_not_called()
    dry_payload=json.loads(artifact.read_text())
    assert not dry_payload["candidates"][0]["accepted"]
    assert "inserted_question_id" not in dry_payload["candidates"][0]
    for _ in range(2):
        result = CliRunner().invoke(ingest.main, flags)
        assert result.exit_code == 1
    assert client.insert_question.call_count == client.create_generation_run.call_count == 1
    row=client.insert_question.call_args.args[0]
    assert row["status"] == "DRAFT"
    notes=json.loads(row["review_notes"])
    assert notes["content_pipeline_judge"]["model"] == EXTERNAL_JUDGE_PROVENANCE
    assert notes["grounding"]["evidence"] == first["evidence"]
    from scripts.review_batch import grounding_errors
    assert grounding_errors({"review_notes": row["review_notes"]}) == []
    assert client.update_question_review.call_args.args[2] == "GOOD"
    final = json.loads(artifact.read_text())
    assert final["candidates"][0]["inserted_question_id"] == first["candidate_id"]
    assert final["candidates"][0]["persistence_status"] == "complete"
    assert final["candidates"][0]["accepted"] is True
    assert final["candidates"][1]["accepted"] is False



def test_external_vendor_policy_and_accidental_inline_judge_fail_closed(monkeypatch):
    from shared.model_policy import model_family, require_independent_models
    from shared.quality_gate import judge_question
    import dspy
    assert model_family("external") == model_family(EXTERNAL_JUDGE_PROVENANCE) == "anthropic"
    assert require_independent_models("codex/gpt-5.6-sol", "external") == ("openai", "anthropic")
    import pytest
    with pytest.raises(ValueError):
        require_independent_models("claude", "external")
    lm=Mock(side_effect=AssertionError("External is not an inline backend"))
    monkeypatch.setattr(dspy,"LM",lm)
    result=judge_question({}, "scope", model="external")
    assert not result.passed and "ingested verdict" in result.reason
    lm.assert_not_called()



def test_native_client_preserves_explicit_question_and_run_primary_keys():
    from shared.supabase_client import SupabaseClient
    client = SupabaseClient.__new__(SupabaseClient)
    client.client = Mock()
    qid = "11111111-1111-5111-8111-111111111111"
    rid = "22222222-2222-5222-8222-222222222222"
    table = client.client.table.return_value
    table.insert.return_value.execute.return_value.data = [{"id":qid}]
    assert client.insert_question({"id":qid,"generation_run_id":rid,"status":"ACTIVE"})["id"] == qid
    row = table.insert.call_args.args[0]
    assert row["id"] == qid and row["status"] == "DRAFT"
    table.insert.return_value.execute.return_value.data = [{"id":rid}]
    assert client.create_generation_run({"id":rid,"domain_code":"fake"})["id"] == rid
    assert table.insert.call_args.args[0]["id"] == rid
