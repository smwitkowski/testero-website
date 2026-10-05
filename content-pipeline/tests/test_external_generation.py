"""Offline external-judge generation contracts; no CLI, network, or DB calls."""
import hashlib
import json
from pathlib import Path
import shlex
from unittest.mock import Mock

import pytest
from click.testing import CliRunner

from scripts import generate_all_domains, generate_pmle_questions as generate
from shared.cli_models import output_model
from shared.evidence import check_evidence
from shared.quality_gate import QuestionQualitySignature
from shared.question_style import STYLE_INSTRUCTIONS

MODEL = "codex/gpt-5.6-sol"
OBJECTIVE = "machine-learning-engineer:standard:1.1:5"
URL = "https://docs.cloud.google.com/run/docs/overview"
QUOTES = ["Cloud Run serves HTTP requests.", "Batch processing is offline.",
          "Object storage stores objects.", "Virtual machines require infrastructure management."]
TEXT = " ".join(QUOTES)
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
    "correct_explanation": "Cloud Run serves HTTP requests for the company's workload.",
    "distractor_1_explanation": "BigQuery batch processing fails the HTTP serving requirement because batch processing is offline.",
    "distractor_2_explanation": "Cloud Storage stores objects and fails the requirement to execute an HTTP request handler.",
    "distractor_3_explanation": "Compute Engine requires infrastructure management and violates the minimal management requirement.",
}


def source(text=TEXT, url=URL):
    return {"requested_url": url, "url": url, "text": text,
            "retrieved_at": "2026-10-05T00:00:00Z",
            "text_sha256": hashlib.sha256(text.encode()).hexdigest()}


def receipts():
    return [{"option_label": label, "url": URL, "quote": quote}
            for label, quote in zip("ABCD", QUOTES)]


@pytest.fixture
def external_generation(monkeypatch, tmp_path):
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    database = Mock(side_effect=AssertionError("External generation must not construct a DB client"))
    judge = Mock(side_effect=AssertionError("External generation must not call an inline judge"))
    search = Mock(return_value=[source()])
    generator = Mock()
    generator.side_effect = lambda *a, **kw: {
        **QUESTION, "stem": f"You manage workload number {generator.call_count}. " + QUESTION["stem"]}
    cite = Mock(side_effect=lambda *a, **kw: {"evidence": receipts()})
    monkeypatch.setattr(generate, "database_client", database)
    monkeypatch.setattr(generate, "judge_question", judge)
    monkeypatch.setattr(generate, "search_objective_docs", search)
    monkeypatch.setattr(generate, "generate_question", generator)
    monkeypatch.setattr(generate, "cite_question", cite)
    return {"path": tmp_path, "database": database, "judge": judge,
            "search": search, "generator": generator, "cite": cite}


def invoke(env, *flags):
    return CliRunner().invoke(generate.main, [
        "--cert", "machine-learning-engineer", "--n-questions", "3",
        "--objective", OBJECTIVE, "--model", MODEL, "--judge-model", "external",
        "--artifact", str(env["path"] / "batch.json"), *flags])


def read_artifact(env):
    return json.loads((env["path"] / "batch.json").read_text())


def read_request(env, candidate):
    reference = candidate["external_judge_request"]
    relative = Path(reference["path"])
    assert not relative.is_absolute()
    path = env["path"] / relative
    assert path.parent == env["path"] / "batch.judge-requests"
    assert path.name == candidate["candidate_id"] + ".json"
    data = path.read_bytes()
    assert reference["sha256"] == hashlib.sha256(data).hexdigest()
    return json.loads(data)


@pytest.mark.parametrize("dry", [False, True])
def test_external_generation_only_queues_requests_never_calls_db_or_judge(external_generation, dry):
    env = external_generation
    result = invoke(env, *(["--dry-run"] if dry else []))
    assert result.exit_code == 0, result.output
    env["database"].assert_not_called()
    env["judge"].assert_not_called()
    assert env["generator"].call_count == env["cite"].call_count == 3
    assert all(call.kwargs["model"] == MODEL for call in env["generator"].call_args_list)
    artifact = read_artifact(env)
    assert artifact["judge_model"] == "external" and artifact["generation_runs"] == {}
    assert artifact["dry_run"] is dry
    ids = [item["candidate_id"] for item in artifact["candidates"]]
    assert len(set(ids)) == len(ids) == 3
    for candidate in artifact["candidates"]:
        assert candidate["status"] == "awaiting_external_judge"
        assert candidate["awaiting_external_judge"] is True
        assert candidate["accepted"] is False and candidate["judge_verdict"]["passed"] is False
        assert candidate["schema_check"]["passed"] and candidate["mechanical_check"]["passed"]
        assert check_evidence(candidate["evidence"], candidate["sources"])["passed"]
        request = read_request(env, candidate)
        assert request["candidate_id"] == candidate["candidate_id"]
        assert request["objective_id"] == OBJECTIVE
        assert request["verdict_schema"] == output_model(QuestionQualitySignature).model_json_schema()
        assert request["verdict_schema"]["additionalProperties"] is False
        assert set(request["verdict_schema"]["required"]) == set(QuestionQualitySignature.output_fields)
        prompt = request["judge_prompt"]
        assert " ".join(QuestionQualitySignature.instructions.split()) in " ".join(prompt.split())
        assert " ".join(STYLE_INSTRUCTIONS.split()) in " ".join(prompt.split())
        assert candidate["stem"] in prompt and URL in prompt
        assert all(quote in prompt for quote in QUOTES)
        assert request["trimming"]["enabled"] is False
    assert len(list((env["path"] / "batch.judge-requests").glob("*.json"))) == 3


@pytest.mark.parametrize("failure", ["schema", "mechanical", "missing_sources"])
def test_rejected_candidate_never_receives_external_request(external_generation, failure):
    env = external_generation
    if failure == "schema":
        env["generator"].side_effect = lambda *a, **kw: {**QUESTION, "stem": "Short"}
    elif failure == "mechanical":
        env["cite"].side_effect = lambda *a, **kw: {
            "evidence": [{**receipt, "quote": "Not in fetched text"} for receipt in receipts()]}
    else:
        env["search"].return_value = []
    result = invoke(env, "--n-questions", "1")
    assert result.exit_code != 0
    env["database"].assert_not_called()
    env["judge"].assert_not_called()
    candidate = read_artifact(env)["candidates"][0]
    assert candidate["accepted"] is False
    assert not candidate.get("awaiting_external_judge", False)
    assert "external_judge_request" not in candidate
    assert not list(env["path"].glob("batch.judge-requests/*.json"))
    if failure == "mechanical":
        assert env["cite"].call_count == 2
        assert env["cite"].call_args_list[1].kwargs["check_errors"]
    else:
        env["cite"].assert_not_called()


def test_all_domains_wrapper_routes_external_without_db(external_generation):
    env = external_generation
    result = generate_all_domains.main(args=[
        "--cert", "machine-learning-engineer", "--n-questions", "1",
        "--objective", OBJECTIVE, "--model", MODEL, "--judge-model", "external",
        "--artifact", str(env["path"] / "batch.json")], standalone_mode=False)
    assert result is None
    env["database"].assert_not_called()
    env["judge"].assert_not_called()
    candidate = read_artifact(env)["candidates"][0]
    assert candidate["awaiting_external_judge"] and not candidate["accepted"]
    read_request(env, candidate)


def test_current_external_runbook_has_exact_style45_plan_and_safe_ingestion():
    from shared.cert_context import DEFAULT_CERT

    suffixes = ("1.1:5", "1.2:1", "1.2:2", "1.2:3", "2.1:3", "2.2:3", "3.1:4",
                "3.2:6", "3.3:1", "4.1:4", "4.1:5", "4.2:4", "5.1:2", "6.1:1", "6.2:3")
    ZERO_IDS = tuple(f"{DEFAULT_CERT}:standard:{suffix}" for suffix in suffixes)

    process = (Path(__file__).parents[1] / "PROCESS.md").read_text()
    section = process.split("### Historical round-3 external-judge style regeneration: 45 candidates", 1)[1]
    blocks = [block.split("```", 1)[0] for block in section.split("```sh\n")[1:]]
    args = shlex.split(blocks[0].replace("\\\n", " "))
    assert [args[i + 1] for i, flag in enumerate(args) if flag == "--objective"] == list(ZERO_IDS)
    assert args[args.index("--n-questions") + 1] == "45"
    assert args[args.index("--model") + 1] == MODEL
    assert args[args.index("--judge-model") + 1] == "external"
    assert args[args.index("--artifact") + 1] == ".cache/generation/pmle-d025-style-45.json"
    assert "--dry-run" not in args
    commands = [shlex.split(block.replace("\\\n", " ")) for block in blocks[1:]]
    run = next(command for command in commands if "scripts/judge_requests.py" in command)
    assert run[run.index("--requests") + 1] == ".cache/generation/pmle-d025-style-45.judge-requests"
    assert run[run.index("--verdicts") + 1] == ".cache/generation/pmle-d025-style-45.verdicts"
    assert run[run.index("--judge-model") + 1] == "claude"
    assert run[run.index("--parallel") + 1] == "3"
    dry, write = [command for command in commands if "scripts/ingest_external_verdicts.py" in command]
    assert "--dry-run" in dry and "--dry-run" not in write
    for command in (dry, write):
        assert "scripts/ingest_external_verdicts.py" in command
        assert command[command.index("--verdicts") + 1] == ".cache/generation/pmle-d025-style-45.verdicts"
    assert "Sonnet 5.5 subagents" in section and "human reconciliation" in section
    assert "never ACTIVE" in section and "review_batch.py" in section


def test_request_uses_exact_shared_signature_prompt_and_raw_schema():
    from shared import external_judge
    from shared.cert_context import plan_questions
    from shared.cli_models import signature_prompt
    from shared.doc_search import documentation_context

    scope = plan_questions("machine-learning-engineer", 1, objective_ids=[OBJECTIVE])[0]
    fetched = [source()]
    evidence = check_evidence(receipts(), fetched)["options"]
    ident = external_judge.candidate_id(1, scope, QUESTION)
    request = external_judge.build_request(ident, scope, QUESTION, fetched, evidence)
    assert set(request) == {"candidate_id", "objective_id", "judge_prompt", "verdict_schema", "trimming"}
    assert request["judge_prompt"] == signature_prompt(QuestionQualitySignature, {
        "question_data": QUESTION, "domain_context": scope["domain_prompt"],
        "documentation_context": documentation_context(fetched), "option_evidence": evidence})
    assert request["verdict_schema"] == output_model(QuestionQualitySignature).model_json_schema()
    assert external_judge.request_directory(Path("/local/batch.json")) == Path("/local/batch.judge-requests")


def test_candidate_ids_are_stable_unique_and_content_bound():
    import uuid
    from shared import external_judge
    from shared.cert_context import plan_questions

    scope = plan_questions("machine-learning-engineer", 1, objective_ids=[OBJECTIVE])[0]
    first = external_judge.candidate_id(1, scope, QUESTION)
    # Mapping order and reconstruction must not alter identity.
    assert first == external_judge.candidate_id(1, dict(scope), dict(reversed(list(QUESTION.items()))))
    assert str(uuid.UUID(first)) == first
    ids = {external_judge.candidate_id(index, scope, QUESTION) for index in range(1, 46)}
    assert len(ids) == 45
    assert first != external_judge.candidate_id(1, scope, {**QUESTION, "correct_explanation": "Changed text"})
    assert first != external_judge.candidate_id(1, {**scope, "guide_sha256": "0" * 64}, QUESTION)
    assert first != external_judge.candidate_id(1, {**scope, "objective_id": OBJECTIVE + "changed"}, QUESTION)


def test_oversize_request_trims_only_sources_preserves_quotes_rubric_and_receipts():
    from shared import external_judge
    from shared.cert_context import plan_questions
    from shared.evidence import normalize_whitespace

    scope = plan_questions("machine-learning-engineer", 1, objective_ids=[OBJECTIVE])[0]
    # Place quotes far apart with normalized whitespace offsets, not a single prefix cut.
    text = ("irrelevant preface\t" * 7000) + ("\n\n" + "large unrelated passage " * 6000).join(QUOTES)
    fetched = [source(text), source("UNCITED_DOCUMENT_SHOULD_NOT_BE_IN_PROMPT", URL + "/uncited")]
    before = json.dumps(fetched, sort_keys=True)
    evidence = check_evidence(receipts(), fetched)["options"]
    assert check_evidence(evidence, fetched)["passed"]
    request = external_judge.build_request("offline-candidate", scope, QUESTION, fetched, evidence)
    serialized = json.dumps(request, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    assert len(serialized) <= external_judge.REQUEST_CHARACTER_LIMIT == 150000
    assert request["trimming"]["enabled"] is True
    assert request["trimming"]["character_limit"] == 150000
    assert request["verdict_schema"] == output_model(QuestionQualitySignature).model_json_schema()
    prompt = request["judge_prompt"]
    assert " ".join(QuestionQualitySignature.instructions.split()) in " ".join(prompt.split())
    assert " ".join(STYLE_INSTRUCTIONS.split()) in " ".join(prompt.split())
    assert scope["objective_id"] in prompt
    assert QUESTION["stem"] in prompt and all(quote in prompt for quote in QUOTES)
    assert "UNCITED_DOCUMENT_SHOULD_NOT_BE_IN_PROMPT" not in prompt
    assert json.dumps(fetched, sort_keys=True) == before
    assert check_evidence(evidence, fetched)["passed"]
    records = request["trimming"]["sources"]
    assert len(records) == 1
    record = records[0]
    assert record["url"] == URL
    assert record["original_text_sha256"] == fetched[0]["text_sha256"]
    assert record["original_characters"] == len(text)
    normalized = normalize_whitespace(text)
    windows = record["windows"]
    assert all(0 <= start < end <= len(normalized) for start, end in windows)
    assert all(left[1] < right[0] for left, right in zip(windows, windows[1:]))
    excerpt = "\n[... source text omitted ...]\n".join(normalized[start:end] for start, end in windows)
    assert record["excerpt_sha256"] == hashlib.sha256(excerpt.encode()).hexdigest()
    assert record["included_characters"] == sum(end - start for start, end in windows)
    assert record["included_characters"] < record["original_characters"]
    assert all(normalize_whitespace(quote) in excerpt for quote in QUOTES)


def test_request_builder_fails_before_request_for_unverified_citations():
    from shared import external_judge
    from shared.cert_context import plan_questions

    scope = plan_questions("machine-learning-engineer", 1, objective_ids=[OBJECTIVE])[0]
    bad = receipts()
    bad[0]["quote"] = "Fabricated source text"
    with pytest.raises(ValueError, match="verified A-D evidence"):
        external_judge.build_request("offline-candidate", scope, QUESTION, [source()], bad)


def test_external_generation_refuses_artifact_reuse_before_any_service(external_generation):
    env = external_generation
    first = invoke(env, "--n-questions", "1")
    assert first.exit_code == 0, first.output
    artifact_bytes = (env["path"] / "batch.json").read_bytes()
    requests_before = {path.name: path.read_bytes()
                       for path in (env["path"] / "batch.judge-requests").glob("*.json")}
    for name in ("search", "generator", "cite"):
        env[name].reset_mock()
    again = invoke(env, "--n-questions", "1")
    assert again.exit_code != 0
    for name in ("database", "judge", "search", "generator", "cite"):
        env[name].assert_not_called()
    assert (env["path"] / "batch.json").read_bytes() == artifact_bytes
    assert {path.name: path.read_bytes()
            for path in (env["path"] / "batch.judge-requests").glob("*.json")} == requests_before


def test_request_bound_does_not_drop_rubric_or_question_to_force_fit():
    from shared import external_judge
    from shared.cert_context import plan_questions

    scope = plan_questions("machine-learning-engineer", 1, objective_ids=[OBJECTIVE])[0]
    scope = {**scope, "domain_prompt": scope["domain_prompt"] + "Scope context. " * 16000}
    with pytest.raises(ValueError, match="character bound"):
        external_judge.build_request("offline-candidate", scope, QUESTION, [source()], receipts())



def test_full_cited_text_between_old_and_new_limit_is_not_trimmed():
    from shared import external_judge
    from shared.cert_context import plan_questions
    scope=plan_questions("machine-learning-engineer",1,objective_ids=[OBJECTIVE])[0]
    text="FULL_DOCUMENT_SUPPORT " * 4000 + " ".join(QUOTES)
    fetched=[source(text)]
    checked=check_evidence(receipts(),fetched)
    request=external_judge.build_request("full-source",scope,QUESTION,fetched,checked["options"])
    size=len(json.dumps(request,indent=2,ensure_ascii=False)+"\n")
    assert 60000 < size <= external_judge.REQUEST_CHARACTER_LIMIT==150000
    assert request["trimming"]["enabled"] is False
    assert text in request["judge_prompt"]
    assert request["trimming"]["sources"][0]["windows"]==[[0,len(text)]]


def test_largest_cited_source_is_trimmed_first_others_stay_full():
    from shared import external_judge
    from shared.cert_context import plan_questions
    scope=plan_questions("machine-learning-engineer",1,objective_ids=[OBJECTIVE])[0]
    large=source("large source passage " * 10000 + " ".join(QUOTES[:2]))
    small=source("SMALL_FULL_TEXT " * 2000 + " ".join(QUOTES[2:]),URL+"/smaller")
    items=receipts()
    for item in items[2:]:item["url"]=small["url"]
    fetched=[small,large]
    checked=check_evidence(items,fetched); assert checked["passed"]
    before=json.dumps(fetched,sort_keys=True)
    request=external_judge.build_request("largest-first",scope,QUESTION,fetched,checked["options"])
    records={record["url"]:record for record in request["trimming"]["sources"]}
    assert request["trimming"]["enabled"]
    assert records[large["url"]]["trimmed"] and records[large["url"]]["margin"]==8000
    assert not records[small["url"]]["trimmed"]
    assert small["text"] in request["judge_prompt"]
    assert json.dumps(fetched,sort_keys=True)==before
    assert len(json.dumps(request,indent=2,ensure_ascii=False)+"\n")<=150000


def test_wide_windows_are_not_silently_narrowed_to_meet_limit(monkeypatch):
    from shared import external_judge
    from shared.cert_context import plan_questions
    scope=plan_questions("machine-learning-engineer",1,objective_ids=[OBJECTIVE])[0]
    text=("irrelevant " * 18000) + (" separator passage " * 2000).join(QUOTES)
    fetched=[source(text)]
    checked=check_evidence(receipts(),fetched); assert checked["passed"]
    monkeypatch.setattr(external_judge,"REQUEST_CHARACTER_LIMIT",20000)
    with pytest.raises(ValueError,match="wide quote-centered"):
        external_judge.build_request("too-large",scope,QUESTION,fetched,checked["options"])


def test_generation_stores_and_prints_length_report_and_new_schema(external_generation):
    env=external_generation
    result=invoke(env,"--n-questions","1")
    assert result.exit_code==0,result.output
    payload=read_artifact(env)
    report=payload["option_length_report"]
    assert report["count"]==1 and report["awaiting_external_judge"]["count"]==1
    assert report["accepted"]["count"]==0
    assert report["target_max_rate"]==.35 and report["key_is_longest_rate"]==1
    assert "WARNING target exceeded" in result.output
    candidate=payload["candidates"][0]
    schema=read_request(env,candidate)["verdict_schema"]
    assert "distractors_need_knowledge" in schema["required"]


def test_opening_and_question_line_hints_are_recorded_in_candidate_and_request(external_generation):
    env=external_generation
    result=invoke(env,"--n-questions","3")
    assert result.exit_code==0,result.output
    payload=read_artifact(env)
    assert [entry["opening_style"] for entry in payload["candidates"]]==["You are","Your company/organization/team","You work for"]
    for entry,scope in zip(payload["candidates"],payload["plan"]):
        assert entry["opening_style"]==scope["opening_style"]
        assert entry["question_line"]==scope["question_line"]
        prompt=read_request(env,entry)["judge_prompt"]
        assert "Opening style: " + scope["opening_style"] in prompt
        assert "Question line hint: " + scope["question_line"] in prompt
