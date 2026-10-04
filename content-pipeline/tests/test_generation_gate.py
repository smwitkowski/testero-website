"""Offline generation contracts: services are mocked; no DB/network access."""
import hashlib
import json
from unittest.mock import Mock

import pytest
from click.testing import CliRunner

from scripts import generate_pmle_questions as generate
from shared.quality_gate import JudgeVerdict
from shared.supabase_client import SupabaseClient

RUN_ID = "11111111-1111-4111-8111-111111111111"
URL = "https://docs.cloud.google.com/run/docs/overview"
TEXT = "Cloud Run serves HTTP requests. Batch processing is offline. Object storage stores objects. Virtual machines require infrastructure management."
QUOTES = ["Cloud Run serves HTTP requests.", "Batch processing is offline.", "Object storage stores objects.", "Virtual machines require infrastructure management."]
QUESTION = {
    "stem": "Your company must serve HTTP requests with minimal infrastructure management. Which solution should you choose?",
    "correct_answer": "Use Cloud Run for HTTP requests",
    "distractor_1": "Use BigQuery batch processing",
    "distractor_2": "Use Cloud Storage object storage",
    "distractor_3": "Use Compute Engine virtual machines",
    "correct_explanation": "Cloud Run serves HTTP requests and handles infrastructure management for the company's workload.",
    "distractor_1_explanation": "BigQuery batch processing fails the HTTP serving requirement because batch processing is offline.",
    "distractor_2_explanation": "Cloud Storage stores objects and fails the requirement to execute an HTTP request handler.",
    "distractor_3_explanation": "Compute Engine requires infrastructure management and violates the minimal management requirement.",
}


@pytest.fixture
def generation(monkeypatch, tmp_path):
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    client = Mock()
    client.get_domain_by_code.return_value = {"id": "domain"}
    client.create_generation_run.return_value = {"id": RUN_ID}
    client.insert_question.return_value = {"id": "question"}
    client.insert_answers_batch.return_value = [{"id": str(i)} for i in range(4)]
    client.insert_explanation.return_value = {"id": "explanation"}
    client.update_question_review.return_value = True
    client.update_generation_run.return_value = {"id": RUN_ID}
    database = Mock(return_value=client)
    monkeypatch.setattr(generate, "database_client", database)
    sources = [{"requested_url": URL, "url": URL, "text": TEXT,
                "retrieved_at": "2026-10-04T00:00:00+00:00", "text_sha256": hashlib.sha256(TEXT.encode()).hexdigest()}]
    search = Mock(return_value=sources)
    monkeypatch.setattr(generate, "search_objective_docs", search)
    raw = {**QUESTION, "evidence": [{"option_label": label, "url": URL, "quote": quote}
                                   for label, quote in zip("ABCD", QUOTES)]}
    def candidate(*args, **kwargs):
        return {**{k: v for k, v in raw.items() if k != "evidence"},
                "stem": f"Request number {generator.call_count}. " + raw["stem"]}
    generator = Mock(side_effect=candidate)
    monkeypatch.setattr(generate, "generate_question", generator)
    generator.cite_mock = Mock(side_effect=lambda *a, **kw: {"evidence": raw["evidence"]})
    monkeypatch.setattr(generate, "cite_question", generator.cite_mock)
    judge = Mock(return_value=JudgeVerdict(True, 0.9, "Offline pass", generate.DEFAULT_JUDGE_MODEL))
    monkeypatch.setattr(generate, "judge_question", judge)
    return client, database, raw, search, generator, judge, tmp_path


def invoke(generation, *flags):
    return CliRunner().invoke(generate.main, ["--n-questions", "1", "--artifact", str(generation[-1] / "pilot.json"), *flags])


@pytest.mark.parametrize("cert,count", [("machine-learning-engineer", 6), ("cloud-engineer", 4)])
def test_pilot_dry_run_exact_plan_all_candidates_and_no_database(generation, cert, count):
    client, database, raw, search, generator, judge, path = generation
    result = invoke(generation, "--cert", cert, "--n-questions", str(count), "--dry-run")
    assert result.exit_code == 0, result.output
    database.assert_not_called()
    assert not client.mock_calls
    artifact = json.loads((path / "pilot.json").read_text())
    assert len(artifact["candidates"]) == count
    assert len(artifact["plan"]) == count
    assert len({c["domain_code"] for c in artifact["candidates"]}) == count
    assert generator.call_count == generator.cite_mock.call_count == judge.call_count == count
    assert all(call.args[0] == verdict.args[0] for call, verdict in zip(generator.cite_mock.call_args_list, judge.call_args_list))
    for item in artifact["candidates"]:
        assert item["cert_id"] == cert and item["objective_id"]
        assert len(item["guide_sha256"]) == 64
        assert item["key"] == "A" and len(item["options"]) == 4
        assert set(item["rationales"]) == set("ABCD")
        assert item["mechanical_check"] == {"passed": True, "errors": []}
        assert len(item["evidence"]) == 4
        assert item["judge_verdict"]["passed"] and item["accepted"]
        assert item["sources"][0]["text"] == TEXT
    assert all(call.kwargs["model"] == generate.DEFAULT_JUDGE_MODEL for call in judge.call_args_list)
    assert all(call.kwargs["generator_model"] == generate.DEFAULT_GENERATOR_MODEL for call in judge.call_args_list)
    assert all(len(call.kwargs["option_evidence"]) == 4 for call in judge.call_args_list)
    assert all(call.args[0] == scope["objective_text"] for call, scope in zip(search.call_args_list, artifact["plan"]))


@pytest.mark.parametrize("model,judge_model", [
    ("openrouter/google/gemini-3.8-flash", "openrouter/google/gemini-2.5-flash"),
    ("unknown/custom", "openrouter/anthropic/claude-sonnet-5.5"),
    ("openrouter/google/gemini-3.8-flash", "unknown/custom"),
])
def test_invalid_vendor_pair_fails_before_all_services(generation, model, judge_model):
    result = invoke(generation, "--dry-run", "--model", model, "--judge-model", judge_model)
    assert result.exit_code != 0
    for service in generation[1], generation[3], generation[4], generation[5]:
        service.assert_not_called()


@pytest.mark.parametrize("failure", ["no_sources", "quote_missing", "wrong_url", "invalid_schema"])
def test_fail_closed_before_judge_and_database_writes_but_artifact_retains_attempt(generation, failure):
    client, database, raw, search, generator, judge, path = generation
    if failure == "no_sources": search.return_value = []
    elif failure == "quote_missing": raw["evidence"][1]["quote"] = "This was never fetched"
    elif failure == "wrong_url": raw["evidence"][1]["url"] = URL + "/not-fetched"
    else: raw["stem"] = "Short"
    result = invoke(generation, "--dry-run")
    assert result.exit_code != 0
    database.assert_not_called()
    judge.assert_not_called()
    record = json.loads((path / "pilot.json").read_text())["candidates"][0]
    assert not record["accepted"] and not record["judge_verdict"]["passed"]
    if failure == "no_sources": generator.assert_not_called()
    else: assert record["stem"]
    if failure in {"quote_missing", "wrong_url"}:
        assert len(record["citation_attempts"]) == 2
        assert generator.cite_mock.call_args_list[1].kwargs["check_errors"]
    else:
        generator.cite_mock.assert_not_called()


@pytest.mark.parametrize("passed", [True, False])
def test_persistence_stays_draft_and_keeps_evidence_even_when_judge_rejects(generation, passed):
    client, _, _, _, _, judge, path = generation
    judge.return_value = JudgeVerdict(passed, 0.9 if passed else 0.2, "Offline verdict", generate.DEFAULT_JUDGE_MODEL)
    result = invoke(generation)
    assert result.exit_code == (0 if passed else 1), result.output
    row = client.insert_question.call_args.args[0]
    assert row["status"] == "DRAFT" and row["generation_run_id"] == RUN_ID
    assert row["review_status"] == ("UNREVIEWED" if passed else "NEEDS_ANSWER_FIX")
    notes = json.loads(row["review_notes"])
    assert notes["content_pipeline_judge"]["passed"] is passed
    assert notes["grounding"]["mechanical_check"]["passed"] is True
    assert len(notes["grounding"]["evidence"]) == 4
    assert notes["grounding"]["generator_model"] == generate.DEFAULT_GENERATOR_MODEL
    assert client.insert_explanation.call_args.args[0]["doc_links"] == [URL]
    assert client.update_question_review.call_args.args[2] == ("GOOD" if passed else "NEEDS_ANSWER_FIX")
    assert client.update_question_review.call_args.args[3] == row["review_notes"]


@pytest.mark.parametrize("failure", ["answers", "explanation", "finalize"])
def test_incomplete_children_never_finalize_good(generation, failure):
    client = generation[0]
    if failure == "answers": client.insert_answers_batch.return_value = []
    elif failure == "explanation": client.insert_explanation.return_value = None
    else: client.update_question_review.return_value = False
    result = invoke(generation)
    assert result.exit_code != 0
    assert client.insert_question.call_args.args[0]["review_status"] == "UNREVIEWED"
    if failure != "finalize": client.update_question_review.assert_not_called()


def test_cleaned_content_is_the_judged_and_stored_content(generation):
    generation[2]["correct_answer"] = "**A. Use Cloud Run for HTTP requests**"
    result = invoke(generation)
    assert result.exit_code == 0, result.output
    assert generation[5].call_args.args[0]["correct_answer"] == "Use Cloud Run for HTTP requests"
    assert generation[0].insert_answers_batch.call_args.args[0][0]["choice_text"] == "Use Cloud Run for HTTP requests"


def test_provider_error_is_recorded_without_secret_body(generation):
    generation[4].side_effect = RuntimeError("PRIVATE provider token must never appear")
    outcome = invoke(generation, "--dry-run")
    assert outcome.exit_code != 0
    text = (generation[-1] / "pilot.json").read_text()
    assert "PRIVATE" not in text + outcome.output
    assert json.loads(text)["candidates"][0]["error_class"] == "RuntimeError"


def test_artifact_outside_ignored_directory_is_rejected_before_services(generation):
    outcome = invoke(generation, "--dry-run", "--artifact", str(generation[-1].parent / "tracked.json"))
    assert outcome.exit_code != 0
    generation[3].assert_not_called()


def test_cli_help_matches_current_default_pair():
    outcome = CliRunner().invoke(generate.main, ["--help"], terminal_width=200)
    assert outcome.exit_code == 0
    assert generate.DEFAULT_GENERATOR_MODEL in outcome.output
    assert generate.DEFAULT_JUDGE_MODEL in outcome.output


@pytest.mark.parametrize("requested_status", ["ACTIVE", "DRAFT", "RETIRED", None])
def test_insert_boundary_always_writes_run_linked_draft(requested_status):
    client = SupabaseClient.__new__(SupabaseClient)
    client.client = Mock()
    client.client.table.return_value.insert.return_value.execute.return_value.data = [{"id": "question"}]
    original = {"stem": "Question", "generation_run_id": RUN_ID, "status": requested_status}
    client.insert_question(original)
    payload = client.client.table.return_value.insert.call_args.args[0]
    assert payload["status"] == "DRAFT" and payload["generation_run_id"] == RUN_ID
    assert original["status"] == requested_status


def test_insert_requires_generation_run():
    client = SupabaseClient.__new__(SupabaseClient)
    client.client = Mock()
    with pytest.raises(ValueError, match="generation_run_id"):
        client.insert_question({"status": "ACTIVE"})
    client.client.table.assert_not_called()


def test_review_finalization_scopes_draft_and_run():
    client = SupabaseClient.__new__(SupabaseClient)
    client.client = Mock()
    chain = client.client.table.return_value
    chain.update.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value.data = [{"id": "question"}]
    assert client.update_question_review("question", RUN_ID, "GOOD", "notes")
    assert chain.eq.call_args_list == [(("id", "question"),), (("generation_run_id", RUN_ID),), (("status", "DRAFT"),)]


def test_identical_redirect_aliases_do_not_create_ambiguous_source_receipts(monkeypatch):
    from shared import doc_search
    first = {"requested_url": URL + "?old", "url": URL, "text": TEXT,
             "retrieved_at": "2026-10-04T00:00:00+00:00", "text_sha256": hashlib.sha256(TEXT.encode()).hexdigest()}
    second = {**first, "requested_url": URL + "?new", "retrieved_at": "2026-10-04T00:00:01+00:00"}
    monkeypatch.setattr(doc_search, "_discover_urls", lambda *args: [first["requested_url"], second["requested_url"]])
    monkeypatch.setattr(doc_search, "_fetch_documentation", Mock(side_effect=[first, second]))
    assert doc_search.search_objective_docs("Synthetic objective", []) == [first]
    second["text_sha256"] = "0" * 64
    monkeypatch.setattr(doc_search, "_fetch_documentation", Mock(side_effect=[first, second]))
    with pytest.raises(doc_search.DocumentationError, match="Conflicting"):
        doc_search.search_objective_docs("Synthetic objective", [])




@pytest.mark.parametrize("failure", ["overlong", "bad_label", "missing_quote", "null_evidence", "omitted_evidence"])
def test_real_cite_step_retains_invalid_receipts_without_judge_or_database(generation, monkeypatch, failure):
    from dspy.utils import DummyLM
    from shared import llm_generator
    records = [{"option_label": label, "url": URL, "quote": quote} for label, quote in zip("ABCD", QUOTES)]
    if failure == "overlong": records[0]["quote"] = "x" * 301
    elif failure == "bad_label": records[0]["option_label"] = "Z"
    elif failure == "missing_quote": del records[0]["quote"]
    elif failure == "null_evidence": records = None
    values = {"evidence": records}
    if failure == "omitted_evidence": del values["evidence"]
    # Two mechanical failures exercise the one allowed citation retry.
    lm = DummyLM([values, values])
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-test-only")
    monkeypatch.setattr(llm_generator.dspy, "LM", lambda **kwargs: lm)
    monkeypatch.setattr(generate, "cite_question", llm_generator.cite_question)
    outcome = invoke(generation, "--dry-run")
    assert outcome.exit_code != 0
    generation[1].assert_not_called()
    generation[5].assert_not_called()
    record = json.loads((generation[-1] / "pilot.json").read_text())["candidates"][0]
    assert record["stem"].endswith(QUESTION["stem"])
    assert len(record["options"]) == len(record["rationales"]) == 4
    assert not record["mechanical_check"]["passed"]
    assert len(record["citation_attempts"]) == 2
    assert "error_class" not in record
    if failure == "overlong": assert len(record["citation_attempts"][0]["evidence"][0]["quote"]) == 301
    if failure == "omitted_evidence":
        assert record["citation_attempts"][0]["parse_failure"]
        assert len(record["citation_attempts"][0].get("raw_response", "")) <= 2048


def test_cite_retry_passes_errors_and_does_not_regenerate_question(generation):
    raw = generation[2]
    bad = [{**e, "quote": "Not in frozen text"} for e in raw["evidence"]]
    generation[4].cite_mock.side_effect = [{"evidence": bad}, {"evidence": raw["evidence"]}]
    outcome = invoke(generation, "--dry-run")
    assert outcome.exit_code == 0, outcome.output
    generation[4].assert_called_once()
    generation[5].assert_called_once()
    cite = generation[4].cite_mock
    assert cite.call_count == 2
    assert cite.call_args_list[0].kwargs["check_errors"] is None
    assert cite.call_args_list[1].kwargs["check_errors"]
    record = json.loads((generation[-1] / "pilot.json").read_text())["candidates"][0]
    assert [a["mechanical_check"]["passed"] for a in record["citation_attempts"]] == [False, True]
    assert record["accepted"]


def test_seed_cli_is_reproducible_and_recorded(generation):
    outcome = invoke(generation, "--dry-run", "--n-questions", "6", "--seed", "1234")
    assert outcome.exit_code == 0, outcome.output
    artifact = json.loads((generation[-1] / "pilot.json").read_text())
    assert artifact["seed"] == 1234
    from shared.cert_context import plan_questions
    assert artifact["plan"] == plan_questions(generate.DEFAULT_CERT, 6, seed=1234)
    assert all("objective_offset" in item for item in artifact["plan"])


def test_cleaner_preserves_normal_see_and_bracketed_terms():
    prose = "Users see the [project] configuration and oversee settings (see details)."
    assert generate.strip_references(prose) == prose
    assert "https://" not in generate.strip_references("Use the setting https://docs.cloud.google.com/path [1]")
    assert "[1]" not in generate.strip_references("Use the setting [1]")
