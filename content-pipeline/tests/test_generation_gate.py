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
    "stem": (
        "You work for a retailer whose order tracking application serves delivery updates over HTTP. "
        "Customers check their orders throughout the day, and the application must handle changing request volume. "
        "Your developers already have the application code and want to run it with minimal infrastructure management, "
        "rather than maintain virtual machines. Which solution should you choose?"
    ),
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
                "stem": f"You manage workload number {generator.call_count}. " + raw["stem"]}
    generator = Mock(side_effect=candidate)
    monkeypatch.setattr(generate, "generate_question", generator)
    generator.cite_mock = Mock(side_effect=lambda *a, **kw: {"evidence": raw["evidence"]})
    monkeypatch.setattr(generate, "cite_question", generator.cite_mock)
    judge = Mock(return_value=JudgeVerdict(True, 0.9, "Offline pass", generate.DEFAULT_JUDGE_MODEL))
    monkeypatch.setattr(generate, "judge_three_gates", judge)
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
    deterministic = [{k: v for k, v in item.items() if k not in {"decision_plan", "decision_proof", "decision_objective"}}
                     for item in artifact["plan"]]
    assert deterministic == plan_questions(generate.DEFAULT_CERT, 6, seed=1234)
    assert all("objective_offset" in item for item in artifact["plan"])


def test_cleaner_preserves_normal_see_and_bracketed_terms():
    prose = "Users see the [project] configuration and oversee settings (see details)."
    assert generate.strip_references(prose) == prose
    assert "https://" not in generate.strip_references("Use the setting https://docs.cloud.google.com/path [1]")
    assert "[1]" not in generate.strip_references("Use the setting [1]")


@pytest.mark.parametrize("invalid", [float("inf"), float("-inf"), float("nan")])
def test_invalid_nonfinite_receipts_are_rejected_but_saved_json_safely(generation, invalid):
    raw = generation[2]
    bad = [{**e, "quote": invalid, "extra": {"numbers": [invalid]}} for e in raw["evidence"]]
    generation[4].cite_mock.side_effect = [{"evidence": bad}, {"evidence": bad}]
    outcome = invoke(generation, "--dry-run")
    assert outcome.exit_code == 1, outcome.output
    generation[1].assert_not_called()
    generation[5].assert_not_called()
    artifact = json.loads((generation[-1] / "pilot.json").read_text(), parse_constant=lambda _: pytest.fail("Invalid JSON constant"))
    candidate = artifact["candidates"][0]
    assert len(candidate["citation_attempts"]) == 2
    assert not candidate["mechanical_check"]["passed"]
    assert "__nonfinite_float__" in candidate["evidence"][0]["quote"]
    assert "__nonfinite_float__" in candidate["evidence"][0]["extra"]["numbers"][0]
    # Artifact serialization must not alter what the checker rejected.
    assert isinstance(bad[0]["quote"], float)


def test_real_citation_parser_numeric_overflow_is_retained_as_debug_marker(generation, monkeypatch):
    from dspy.utils import DummyLM
    from shared import llm_generator
    receipts = [{"option_label": label, "url": URL, "quote": quote} for label, quote in zip("ABCD", QUOTES)]
    receipts[0]["quote"] = "OVERFLOW_PLACEHOLDER"
    completion = json.dumps(receipts).replace('"OVERFLOW_PLACEHOLDER"', "1e999")
    # DummyLM accepts field dictionaries; the raw field string preserves 1e999.
    lm = DummyLM([{"evidence": completion}, {"evidence": completion}])
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-test-only")
    monkeypatch.setattr(llm_generator.dspy, "LM", lambda **kwargs: lm)
    monkeypatch.setattr(generate, "cite_question", llm_generator.cite_question)
    outcome = invoke(generation, "--dry-run")
    assert outcome.exit_code == 1, outcome.output
    generation[1].assert_not_called()
    generation[5].assert_not_called()
    artifact = json.loads((generation[-1] / "pilot.json").read_text())
    candidate = artifact["candidates"][0]
    assert len(candidate["citation_attempts"]) == 2
    assert candidate["evidence"][0]["quote"] == {"__nonfinite_float__": "Infinity"}
    assert not candidate["mechanical_check"]["passed"]


def test_explicit_objective_cli_round_robin_drafts_and_domain_run_ids(generation):
    client, _, _, search, generator, judge, path = generation
    first = "machine-learning-engineer:standard:1.1:5"
    second = "machine-learning-engineer:standard:6.1:1"
    result = invoke(generation, "--n-questions", "4", "--objective", first, "--objective", second)
    assert result.exit_code == 0, result.output
    artifact = json.loads((path / "pilot.json").read_text())
    assert [item["objective_id"] for item in artifact["plan"]] == [first, second, first, second]
    assert artifact["requested_objective_ids"] == [first, second]
    assert set(artifact["generation_runs"]) == {"ARCHITECTING_LOW_CODE_ML_SOLUTIONS", "MONITORING_ML_SOLUTIONS"}
    assert set(artifact["generation_runs"].values()) == {RUN_ID}
    assert result.output.count("Generation run ") == 2
    assert generator.call_count == search.call_count == judge.call_count == client.insert_question.call_count == 4
    assert all(call.args[0]["status"] == "DRAFT" for call in client.insert_question.call_args_list)
    assert client.create_generation_run.call_count == 2
    assert all(call.args[0]["target_count"] == 2 for call in client.create_generation_run.call_args_list)


def test_explicit_objective_cli_invalid_id_precedes_services(generation):
    outcome = invoke(generation, "--objective", "machine-learning-engineer:standard:99.9:1")
    assert outcome.exit_code != 0 and "Objective" in outcome.output
    for service in generation[1], generation[3], generation[4], generation[5]:
        service.assert_not_called()


def test_explicit_objective_dry_run_has_no_generation_runs(generation):
    target = "machine-learning-engineer:standard:3.2:6"
    outcome = invoke(generation, "--dry-run", "--objective", target)
    assert outcome.exit_code == 0, outcome.output
    generation[1].assert_not_called()
    artifact = json.loads((generation[-1] / "pilot.json").read_text())
    assert artifact["requested_objective_ids"] == [target]
    assert artifact["generation_runs"] == {}
    assert artifact["plan"][0]["objective_id"] == target


@pytest.mark.parametrize("passed", [False, True])
def test_judge_failure_diagnostics_are_local_only_and_success_shape_unchanged(generation, passed):
    diagnostics = {"raw_response": "Actual failed judge completion", "finish_reason": "stop",
                   "usage": {"prompt_tokens": 7, "completion_tokens": 11, "total_tokens": 18}}
    verdict = JudgeVerdict(passed, 0.9 if passed else 0.2, "Offline verdict", generate.DEFAULT_JUDGE_MODEL,
                           **({} if passed else {"diagnostics": diagnostics}))
    generation[5].return_value = verdict
    outcome = invoke(generation)
    assert outcome.exit_code == (0 if passed else 1), outcome.output
    artifact = json.loads((generation[-1] / "pilot.json").read_text())
    row = artifact["candidates"][0]
    assert ("diagnostics" in row["judge_verdict"]) is (not passed)
    if not passed:
        assert row["judge_verdict"]["diagnostics"] == diagnostics
    notes = json.loads(generation[0].insert_question.call_args.args[0]["review_notes"])
    assert "diagnostics" not in notes["content_pipeline_judge"]
    assert set(notes["content_pipeline_judge"]) == {"version", "passed", "score", "reason", "model"}
    assert "Actual failed judge completion" not in json.dumps(notes)


def test_generation_parse_diagnostics_survive_in_artifact(generation):
    diagnostics = {"raw_response": "Actual generator completion " + "x" * 9000,
                   "finish_reason": "stop", "usage": {"completion_tokens": 100}}
    generation[4].side_effect = generate.GenerationOutputError(diagnostics["raw_response"], diagnostics=diagnostics)
    outcome = invoke(generation, "--dry-run")
    assert outcome.exit_code != 0
    row = json.loads((generation[-1] / "pilot.json").read_text())["candidates"][0]
    assert row["raw_response"] == diagnostics["raw_response"]
    assert row["diagnostics"] == diagnostics
    generation[4].cite_mock.assert_not_called()
    generation[5].assert_not_called()
    generation[1].assert_not_called()


def test_citation_parse_diagnostics_survive_in_attempts(generation):
    diagnostics = {"raw_response": "Actual failed citation completion " + "x" * 9000,
                   "finish_reason": "stop", "usage": {"completion_tokens": 100}}
    generation[4].cite_mock.side_effect = None
    generation[4].cite_mock.return_value = {"evidence": None, "parse_failure": "Citation output could not be parsed",
                                          "raw_response": diagnostics["raw_response"], "diagnostics": diagnostics}
    outcome = invoke(generation, "--dry-run")
    assert outcome.exit_code != 0
    row = json.loads((generation[-1] / "pilot.json").read_text())["candidates"][0]
    assert len(row["citation_attempts"]) == 2
    assert all(attempt["diagnostics"] == diagnostics for attempt in row["citation_attempts"])
    assert all(attempt["raw_response"] == diagnostics["raw_response"] for attempt in row["citation_attempts"])
    generation[5].assert_not_called()


def test_transport_diagnostics_attribute_is_not_trusted(generation):
    error = RuntimeError("PRIVATE provider transport body")
    error.diagnostics = {"raw_response": "PRIVATE", "messages": "PRIVATE"}
    generation[4].side_effect = error
    outcome = invoke(generation, "--dry-run")
    assert outcome.exit_code != 0
    text = (generation[-1] / "pilot.json").read_text()
    assert "PRIVATE" not in text + outcome.output
    row = json.loads(text)["candidates"][0]
    assert "diagnostics" not in row and "raw_response" not in row


@pytest.mark.parametrize("failure,stage", [
    ("schema", "schema"), ("mechanical", "mechanical"), ("duplicate", "duplicate"),
    ("judge", "judge"), ("persistence", "persistence"), ("transport", "generation"),
])
def test_every_nonaccepted_candidate_has_explicit_gate_reason(generation, failure, stage):
    if failure == "schema":
        generation[2]["stem"] = "Short"
    elif failure == "mechanical":
        generation[2]["evidence"][0]["quote"] = "Not in source"
    elif failure == "duplicate":
        generation[4].side_effect = lambda *args, **kwargs: {key: value for key, value in generation[2].items() if key != "evidence"}
    elif failure == "judge":
        generation[5].return_value = JudgeVerdict(False, 0.6, "Unsupported explanation", generate.DEFAULT_JUDGE_MODEL)
    elif failure == "persistence":
        generation[0].insert_answers_batch.return_value = []
    else:
        error = RuntimeError("PRIVATE provider exception body")
        error.diagnostics = {"raw_response": "PRIVATE"}
        generation[4].side_effect = error
    flags = ["--n-questions", "2"] if failure == "duplicate" else []
    outcome = invoke(generation, *flags)
    assert outcome.exit_code != 0
    artifact_text = (generation[-1] / "pilot.json").read_text()
    rows = json.loads(artifact_text)["candidates"]
    failed = [row for row in rows if not row["accepted"]]
    assert failed
    assert all(row["reason"].strip() and row["failure_stage"] == stage for row in failed)
    assert "PRIVATE" not in artifact_text + outcome.output
    assert all("reason" not in row and "failure_stage" not in row for row in rows if row["accepted"])


@pytest.mark.parametrize("index", [9, 13, 15])
def test_real_batch2_stems_follow_new_style_gate_without_rewording(generation, index):
    from pathlib import Path
    fixture = json.loads((Path(__file__).parent / "fixtures/pmle_batch2_schema_failures.json").read_text())
    case = next(item for item in fixture["cases"] if item["index"] == index)
    generation[4].side_effect = None
    generation[4].return_value = case["question"]
    generation[5].return_value = JudgeVerdict(False, 0.6, "Independent judge rejected content", generate.DEFAULT_JUDGE_MODEL)
    outcome = invoke(generation, "--dry-run", "--objective", case["objective_id"])
    assert outcome.exit_code != 0
    row = json.loads((generation[-1] / "pilot.json").read_text())["candidates"][0]
    assert not row["accepted"]
    assert not any("scenario indicators" in error for error in row["schema_check"]["errors"])
    if index in (9, 15):
        assert not row["schema_check"]["passed"]
        assert any("requirements checklist" in error for error in row["schema_check"]["errors"])
        if index == 9:
            assert any("documentation/specification" in error for error in row["schema_check"]["errors"])
        assert row["failure_stage"] == "schema"
        generation[4].cite_mock.assert_not_called()
        generation[5].assert_not_called()
    else:
        assert row["schema_check"] == {"passed": True, "errors": []}
        assert row["failure_stage"] == "judge"
        assert row["reason"] == "Independent judge rejected content"
        generation[4].cite_mock.assert_called_once()
        generation[5].assert_called_once()
    generation[1].assert_not_called()


def test_batch2_schema_fixture_matches_original_when_available():
    from pathlib import Path
    fixture = json.loads((Path(__file__).parent / "fixtures/pmle_batch2_schema_failures.json").read_text())
    artifact = Path(__file__).parents[1] / fixture["provenance"]["artifact"]
    if artifact.exists():
        assert hashlib.sha256(artifact.read_bytes()).hexdigest() == fixture["provenance"]["artifact_sha256"]


@pytest.mark.parametrize("stage", ["generation", "citation", "judge"])
def test_subscription_usage_limit_stops_batch_cleanly(generation, stage):
    from shared.cli_models import CLIUsageLimitError
    client, database, raw, search, generator, judge, path = generation
    error = CLIUsageLimitError("CLI subscription usage or rate limit reached; batch stopped")
    target = {"generation":generator, "citation":generator.cite_mock, "judge":judge}[stage]
    target.side_effect = error
    result = invoke(generation, "--n-questions", "3", "--model", "codex", "--dry-run")
    assert result.exit_code != 0 and "batch stopped" in result.output
    payload = json.loads((path / "pilot.json").read_text())
    assert len(payload["candidates"]) == 1
    assert payload["batch_stop"]["index"] == 1
    assert payload["batch_stop"]["error_class"] == "CLIUsageLimitError"
    assert payload["candidates"][0]["failure_stage"] == stage
    assert payload["candidates"][0]["scenario_moment"] == payload["plan"][0]["scenario_moment"]
    assert search.call_count == 1
    database.assert_not_called()
    assert not client.mock_calls


def test_non_dry_usage_stop_finishes_runs_without_candidate_writes(generation):
    from shared.cli_models import CLIUsageLimitError
    generation[4].side_effect = CLIUsageLimitError("CLI subscription usage or rate limit reached; batch stopped")
    result = invoke(generation, "--n-questions", "3", "--model", "codex")
    assert result.exit_code != 0 and "batch stopped" in result.output
    generation[0].insert_question.assert_not_called()
    assert generation[0].update_generation_run.call_count > 0
    assert all(call.args[1]["generated_count"] == 0 for call in generation[0].update_generation_run.call_args_list)


def test_rejected_codex_model_stops_batch_without_fallback(generation):
    from shared.cli_models import CodexModelRejectedError
    generation[4].side_effect = CodexModelRejectedError("Codex rejected model gpt-6.1-sol; no fallback was attempted. Cached model choices: gpt-6-astra")
    result = invoke(generation, "--n-questions", "3", "--model", "codex/gpt-6.1-sol", "--dry-run")
    assert result.exit_code != 0 and "no fallback was attempted" in result.output
    payload = json.loads((generation[-1] / "pilot.json").read_text())
    assert len(payload["candidates"]) == 1
    assert payload["batch_stop"]["error_class"] == "CodexModelRejectedError"
    assert generation[4].call_count == 1
    assert generation[4].call_args.kwargs["model"] == "codex/gpt-6.1-sol"
    generation[4].cite_mock.assert_not_called()
