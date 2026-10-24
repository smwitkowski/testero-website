"""Synthetic offline PDE pipeline integration. No sample content or live services.

Model outputs and factual judgments are explicitly synthetic. Deterministic
format, provenance, duplication and cap checks execute their real code.
"""
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
from threading import Barrier, Event, Lock
from unittest.mock import Mock

import click
from click.testing import CliRunner
import pytest

from scripts import generate_pmle_questions as generate
from scripts import ingest_external_verdicts as ingest
from scripts import export_judge_requests as exporter
from scripts import repair_candidates as repair
from shared import cli_models
from shared.cert_context import plan_questions
from scripts.generate_pmle_questions import TUNING_SCOPE_FIELDS
from shared.cert_generation_policy import check_product_share, product_share_report
from shared.external_judge import candidate_question, build_request, documentation_context_limit
from shared.option_order import canonical_evidence
from shared.gates import blind_choice_map, gate_signatures
from shared.distractor_evidence import verdict_with_policy
from shared.objective_style import style_policy

URL = "https://docs.cloud.google.com/dataproc/docs/concepts/overview"
QUOTE = "Synthetic offline receipt anchor for every action."
SOURCE = {"url": URL, "requested_url": URL, "text": QUOTE,
          "text_sha256": sha256(QUOTE.encode()).hexdigest(), "retrieved_at": "2026-10-20T00:00:00Z"}
RECEIPTS = [{"option_label": label, "url": URL, "quote": QUOTE} for label in "ABCD"]
OBJECTIVE = "data-engineer:standard:2.1:1"
LIFECYCLE = [
    "Use a Dataproc workflow template to create an ephemeral cluster for each execution and delete it afterward.",
    "Keep the existing Dataproc cluster running and configure autoscaling to adjust worker capacity during each scheduled execution.",
    "Stop the persistent Dataproc cluster between scheduled executions and restart the same cluster before processing each new workload.",
    "Keep the Dataproc cluster available between scheduled executions and configure an idle timeout to delete inactive cluster resources.",
]
STEM = ("Your team processes supplier records using Managed Service for Apache Spark. "
        "Scheduled transformations finish overnight, but usage charges continue during quiet periods. "
        "You want less manual operational work for the small engineering team. What should you do?")


def question(actions=None, stem=STEM):
    actions = actions or LIFECYCLE
    return dict(zip(("stem", "correct_answer", "distractor_1", "distractor_2", "distractor_3",
                     "correct_explanation", "distractor_1_explanation", "distractor_2_explanation", "distractor_3_explanation"),
                    [stem, *actions,
                     "Synthetic correct action is supported by the frozen receipt used in this offline contract test.",
                     "Synthetic alternative fails because its operation does not address the scenario's operational tradeoff.",
                     "Synthetic alternative fails because the selected workflow has a different operational tradeoff.",
                     "Synthetic alternative fails because its timing does not address the scenario's operational tradeoff."]))


def plan(scope, actions, marker):
    return {"objective_id": scope["objective_id"], "engineering_decision": marker,
            "business_consequence": "Keep supplier processing reliable", "existing_system": "Nightly supplier transformations",
            "decisive_constraints": ["Minimize operational work"], "best_action": actions[0],
            "mistakes": [{"action": action, "scenario_reason": "Synthetic scenario-specific losing reason"} for action in actions[1:]]}


def proof(*args, **kwargs):
    return {"passed": True, "supported": True, "uniquely_best": True,
            "distractor_evidence": deepcopy(args[0]["distractor_evidence"]),
            "scenario_reasons_supported": True, "no_feature_gotchas": True,
            "reason": "Synthetic proof, not a live factual review",
            "mechanical_check": {"passed": True, "errors": []},
            "reasons": [{**receipt, "scenario_reason": "Synthetic scenario-specific reason"} for receipt in RECEIPTS]}


def verdict(q, *, failed=False):
    raw = {}
    for name, signature in gate_signatures(style_policy=style_policy(OBJECTIVE)).items():
        checks = {field: True for field, info in signature.output_fields.items() if info.annotation is bool}
        if name == "blind_solver":
            raw[name] = {"verdict": "PASS", "choice": next(label for label, origin in blind_choice_map(q).items() if origin == "A"),
                         "confidence": .9, "ambiguous_answers": False, "reason": "Synthetic independent solver"}
        else:
            raw[name] = {"verdict": "PASS", "score": .9, "reason": "Synthetic independent review", **checks}
    raw["style"]["generic_validation_key"] = False
    if failed:
        raw["style"].update(verdict="FAIL", inference_required=False)
    return raw


@pytest.fixture
def harness(monkeypatch, tmp_path):
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    db = Mock(side_effect=AssertionError("No database factory permitted"))
    for module in (generate, ingest): monkeypatch.setattr(module, "database_client", db)
    # These guards are independent of the explicit synthetic model-stage mocks.
    monkeypatch.setattr("dspy.LM", Mock(side_effect=AssertionError("No live model")))
    monkeypatch.setattr(cli_models, "run_signature", Mock(side_effect=AssertionError("No CLI process")))
    search = Mock(return_value=[deepcopy(SOURCE)])
    monkeypatch.setattr(generate, "search_objective_docs", search)
    monkeypatch.setattr(generate, "verify_decision", proof)
    monkeypatch.setattr(generate, "cite_question", Mock(side_effect=AssertionError("All synthetic receipts supplied by writer")))
    # Isolate the additive answer-pattern gate from the unchanged old Jaccard gate.
    for module in (generate, ingest):
        monkeypatch.setattr(module, "check_near_duplicate", lambda *a, **kw: {"passed": True, "matches": []})
    monkeypatch.setattr(generate, "check_plan_near_duplicate", lambda *a, **kw: {"passed": True, "matches": []})

    def run(specs=None, *, n=None, flags=(), race=False, stop_after=None):
        specs = specs or [(LIFECYCLE, question())]
        count = len(specs) if n is None else n
        markers = {f"integration-slot-{i}": (actions, q) for i, (actions, q) in enumerate(specs, 1)}
        serial, lock = [0], Lock()
        both_planned, second_written = Barrier(2), Event()
        def planner(scope, **kw):
            with lock:
                serial[0] += 1
                # Two-slot race maps to frozen plan order, not thread arrival order.
                i = scope["key_length_rank"] if race else serial[0]
            if stop_after is not None and i > stop_after:
                raise cli_models.CLIUsageLimitError("Synthetic admission stop")
            actions, _ = specs[i-1]
            value = plan(scope, actions, f"integration-slot-{i}")
            if race: both_planned.wait(timeout=5)
            return value
        def writer(context, *args, **kw):
            marker = next(marker for marker in sorted(markers, key=len, reverse=True) if marker in context)
            _, q = markers[marker]
            if race:
                if marker.endswith("-1"): assert second_written.wait(timeout=5)
                else: second_written.set()
            return {**deepcopy(q), "evidence": deepcopy(RECEIPTS)}
        planner_mock, writer_mock = Mock(side_effect=planner), Mock(side_effect=writer)
        monkeypatch.setattr(generate, "plan_decision", planner_mock)
        monkeypatch.setattr(generate, "generate_question", writer_mock)
        path = tmp_path / f"run-{len(list(tmp_path.glob('run-*.json')))}.json"
        result = CliRunner().invoke(generate.main, ["--cert", "data-engineer", "--n-questions", str(count),
            "--objective", OBJECTIVE, "--model", "codex", "--judge-model", "external", "--parallel", "2" if race else "1",
            "--no-doc-cache", "--artifact", str(path), *flags])
        assert path.exists(), (result.output, repr(result.exception))
        payload = json.loads(path.read_text())
        return path, payload, result, planner_mock, writer_mock
    return run, db, search, tmp_path


def save_verdicts(path, payload, *, failed=False):
    directory = path.parent / (path.stem + ".verdicts")
    directory.mkdir(exist_ok=True)
    for entry in payload["candidates"]:
        if "external_judge_request" in entry:
            raw = verdict_with_policy(verdict(candidate_question(entry), failed=failed), entry.get("distractor_evidence"))
            (directory / (entry["candidate_id"] + ".json")).write_text(json.dumps(raw))
    return directory


def test_short_stem_name_normalization_generator_request_scope_rebuild_and_export(harness):
    run, db, _, _ = harness
    path, payload, result, _, _ = run()
    assert result.exit_code == 0, (result.output, repr(result.exception))
    entry = payload["candidates"][0]; q = candidate_question(entry)
    assert 30 <= len(q["stem"].split()) < 40
    assert "Dataproc" in q["stem"] and "Managed Service for Apache Spark" not in q["stem"]
    assert entry["schema_check"]["passed"] and entry["cert_style_check"]["passed"]
    scope = ingest._scope(payload, entry)
    original = path.parent / entry["external_judge_request"]["path"]
    request = json.loads(original.read_text())
    rebuilt = build_request(entry["candidate_id"], scope, q, entry["sources"], canonical_evidence(entry),
                            execution_policy=payload["execution_policy"],
                            doc_context_chars=documentation_context_limit(payload, entry))
    assert rebuilt == request
    assert {"inference_required", "options_no_goal_restatement"} <= set(request["gates"]["style"]["verdict_schema"]["required"])
    _, frozen_question, _ = ingest._validate_candidate(path, payload, entry)
    assert frozen_question == q
    before = original.read_bytes()
    exporter.export_requests(path)
    assert original.read_bytes() == before
    verdicts = save_verdicts(path, json.loads(path.read_text()))
    ingest.ingest(path, verdicts, dry_run=True)
    reviewed = json.loads(path.read_text())["candidates"][0]
    assert reviewed["judge_verdict"]["passed"] and reviewed["grounding"]["style_policy"]["version"] == "5.3"
    assert reviewed["accepted"] is False
    db.assert_not_called()


def test_bank_same_mechanism_and_distractors_reject_before_documentation(harness):
    run, db, search, tmp_path = harness
    bank = tmp_path / "bank.json"
    bank.write_text(json.dumps([{"id": "legacy-bank-item", "cert_id": "data-engineer", "status": "ACTIVE",
        "stem": "A hospital compiles laboratory data for a different business workflow.", "key": "A",
        "options": [{"label": label, "text": action} for label, action in zip("ABCD", LIFECYCLE)]}]))
    _, payload, result, _, writer = run(flags=("--existing-questions", str(bank)))
    assert result.exit_code == 1
    entry = payload["candidates"][0]
    assert entry["failure_stage"] == "answer_pattern"
    assert entry["answer_pattern_plan_check"]["matches"][0]["matched_id"] == "legacy-bank-item"
    search.assert_not_called(); writer.assert_not_called(); db.assert_not_called()


def test_ordered_publication_rejects_higher_slot_when_written_patterns_collide(harness):
    run, db, _, _ = harness
    # Proposals differ; both writers independently converge on the same skeleton.
    different = ["Archive completed source objects in Cloud Storage and attach retention labels for later review.",
                 "Stream incoming messages through Dataflow with a fixed aggregation window and regional worker placement.",
                 "Load operational records into Spanner and configure a separate read-only transaction for each batch.",
                 "Export historical objects into Cloud SQL and build relational indexes before starting each scheduled transformation."]
    specs = [(LIFECYCLE, question()), (different, question(stem=STEM.replace("supplier", "warehouse")))]
    path, payload, result, _, writer = run(specs, race=True)
    assert result.exit_code == 1, result.output
    first, second = payload["candidates"]
    assert [first["index"], second["index"]] == [1, 2]
    assert first["awaiting_external_judge"] and second["failure_stage"] == "answer_pattern"
    assert second["answer_pattern_plan_check"]["passed"] and not second["answer_pattern_check"]["passed"]
    assert writer.call_count == 2
    assert len(list(path.with_suffix(".judge-requests").glob("*.json"))) == 1
    db.assert_not_called()


def test_planned_reservation_cap_is_16_of_40_but_actual_cap_uses_actual_population():
    reserved = [f"Use BigQuery to process uniquely named reservation {i}." for i in range(15)]
    sixteen = check_product_share("Run another transformation in BigQuery.", reserved, 40)
    seventeen = check_product_share("Run another transformation in BigQuery.", [*reserved, "Use BigQuery once more."], 40)
    assert sixteen["passed"] and sixteen["max_per_product"] == 16
    assert not seventeen["passed"] and seventeen["counts"]["BigQuery"] == 17
    actual = product_share_report(["Use BigQuery for joins.", "Use BigQuery for partitions.", "Use Dataproc for Spark."])
    assert not actual["passed"] and actual["denominator"] == 3 and actual["max_per_product"] == 1


def distinct_specs():
    actions = [
        ["Build a BigQuery materialized view over daily sales aggregates and expose the refreshed result through authorized reporting datasets.",
         "Repartition incoming Dataflow messages by device identity and emit processing summaries through a regional event stream.",
         "Copy validated records into Spanner and run transaction snapshots through a separate reconciliation service account.",
         "Store compressed Cloud Storage archives under immutable retention policies and rebuild full reports from nightly exports."],
        ["Configure BigQuery row access policies for regional analyst groups and grant access through separately managed identity groups.",
         "Run Dataproc cluster maintenance tasks using an ephemeral workflow and replace scheduled virtual machine management scripts.",
         "Attach Cloud Storage lifecycle transitions to raw capture buckets and inspect archived objects through a batch process.",
         "Capture Cloud SQL transaction logs with a dedicated replica and load operational snapshots into downstream reporting tables."],
        LIFECYCLE,
    ]
    return [(row, question(row, STEM.replace("supplier", noun))) for row, noun in zip(actions, ("supplier", "retailer", "factory"))]


def test_ingest_small_section_reports_concentration_without_blocking(harness):
    run, db, _, _ = harness
    path, payload, result, _, _ = run(distinct_specs())
    assert result.exit_code == 0, result.output
    waiting = [e for e in payload["candidates"] if e.get("awaiting_external_judge")]
    assert len(waiting) == 3
    directory = save_verdicts(path, payload)
    summary = ingest.ingest(path, directory, dry_run=True)
    saved = json.loads(path.read_text())
    assert saved["section_product_share_report"]["denominator"] == 3
    assert saved["section_product_share_report"]["passed"] is False
    assert saved["product_share_report"]["denominator"] == 40
    assert saved["product_share_report"]["counts"]["BigQuery"] == 2
    assert saved["product_share_report"]["passed"] is True
    assert len(summary["selected_candidates"]) == 3
    assert all(e["publication_selected"] for e in saved["candidates"])
    db.assert_not_called()


@pytest.mark.parametrize("field", ["required_topic_id", "stem_word_range", "required_topic_guidance", "generation_policy"])
def test_active_scope_rejects_mixed_or_tampered_tuning_fields(harness, field):
    run, db, _, _ = harness
    _, payload, _, _, _ = run()
    assert field in TUNING_SCOPE_FIELDS
    entry = payload["candidates"][0]
    entry[field] = "tampered"
    with pytest.raises(ValueError): ingest._scope(payload, entry)
    payload["plan"][0][field] = "tampered"
    with pytest.raises(ValueError): ingest._scope(payload, entry)
    db.assert_not_called()


def test_historical_pde51_scope_replays_untuned_and_mixed_batch_policy_rejects(harness):
    _, db, _, _ = harness
    scope = plan_questions("data-engineer", 1, objective_ids=[OBJECTIVE], generation_tuning=False)[0]
    # Frozen historical policy, not the current new-candidate style selector.
    scope["style_policy"] = {"version": "5.1", "objective_id": OBJECTIVE, "allowance": None}
    payload = {"cert_id": "data-engineer", "plan": [scope], "style_policy_version": "5.1", "rules_version": 5}
    entry = {**deepcopy(scope), "index": 1}
    assert ingest._scope(payload, entry) == scope
    assert scope["style_policy"]["version"] == "5.1"
    assert not set(TUNING_SCOPE_FIELDS) & set(scope)
    payload["style_policy_version"] = "5.2"
    with pytest.raises(ValueError): ingest._scope(payload, entry)
    db.assert_not_called()


def test_unknown_persistence_journal_requires_reconciliation_not_runtime_error(harness):
    run, db, _, _ = harness
    path, payload, _, _, _ = run()
    entry = payload["candidates"][0]
    entry["persistence_status"] = "unknown"
    path.write_text(json.dumps(payload))
    directory = save_verdicts(path, payload)
    with pytest.raises(click.ClickException, match="reconciliation") as error:
        ingest.ingest(path, directory, dry_run=False)
    assert not isinstance(error.value, UnboundLocalError)
    db.assert_not_called()


def test_repair_inventory_demands_new_bools_and_preserves_frozen_scope(harness):
    run, db, _, _ = harness
    path, payload, _, _, _ = run()
    frozen = deepcopy(payload["plan"][0]); directory = save_verdicts(path, payload, failed=True)
    summary = repair.repair_candidates(path, directory, dry_run=True)
    assert summary["eligible"] == 1 and summary["attempted"] == 0
    assert json.loads(path.read_text())["plan"][0] == frozen
    verdict_path = directory / (payload["candidates"][0]["candidate_id"] + ".json")
    broken = json.loads(verdict_path.read_text()); broken["style"].pop("inference_required")
    verdict_path.write_text(json.dumps(broken))
    summary = repair.repair_candidates(path, directory, dry_run=True)
    assert summary["eligible"] == 0 and summary["attempted"] == 0
    assert json.loads(path.read_text())["plan"][0] == frozen
    db.assert_not_called()


@pytest.mark.parametrize("repair_cap", [20_000, 400_000])
def test_repair_publishes_frozen_child_despite_unrelated_failed_placeholder(harness, monkeypatch, repair_cap):
    run, db, _, _ = harness
    # Slot two fails before a learner item exists; it must not poison comparisons.
    path, payload, _, _, _ = run(n=2, stop_after=1)
    parent = payload["candidates"][0]
    assert payload["candidates"][1]["options"] == []
    directory = save_verdicts(path, payload, failed=True)
    old_question = candidate_question(parent)
    revised = {**old_question, "stem": old_question["stem"].replace("supplier", "purchasing")}
    transport = Mock(return_value=revised)
    monkeypatch.setattr(cli_models, "run_signature", transport)
    monkeypatch.setattr(repair, "cite_question", Mock(return_value={"evidence": deepcopy(RECEIPTS)}))
    summary = repair.repair_candidates(path, directory, parallel=1, doc_context_chars=repair_cap)
    assert summary["repaired"] == 1 and summary["failed"] == 0, summary
    saved = json.loads(path.read_text()); child = next(e for e in saved["candidates"] if "repair" in e)
    for field in ["style_policy", "decision_plan", "decision_proof", *TUNING_SCOPE_FIELDS]:
        assert child[field] == parent[field]
    assert candidate_question(child)["correct_answer"] == old_question["correct_answer"]
    assert child["answer_pattern_check"]["passed"] and transport.call_count == 1
    assert child["documentation_context_policy"] == {"version": 1, "max_chars": repair_cap}
    assert saved["documentation_context_policy"] == {"version": 1, "max_chars": 400_000}
    child_scope = ingest._scope(saved, child)
    request_path = path.parent / child["external_judge_request"]["path"]
    request = json.loads(request_path.read_text())
    rebuilt = build_request(child["candidate_id"], child_scope, candidate_question(child),
                            child["sources"], canonical_evidence(child),
                            execution_policy=saved["execution_policy"],
                            doc_context_chars=documentation_context_limit(saved, child))
    assert request == rebuilt
    assert request["execution_policy"] == "short_circuit_v2"
    _, validated, _ = ingest._validate_candidate(path, saved, child)
    assert validated == revised
    db.assert_not_called()


def test_repair_enforces_pde_hard_stem_cap_before_fresh_citation(harness, monkeypatch):
    run, db, _, _ = harness
    path, payload, _, _, _ = run()
    frozen = deepcopy(payload["plan"][0]); directory = save_verdicts(path, payload, failed=True)
    revised = candidate_question(payload["candidates"][0])
    revised["stem"] = "Your team " + "observation " * 80 + "What should you do?"
    assert len(revised["stem"].split()) == 86
    monkeypatch.setattr(cli_models, "run_signature", Mock(return_value=revised))
    cite = Mock(side_effect=AssertionError("Invalid stem must not reach citation"))
    monkeypatch.setattr(repair, "cite_question", cite)
    summary = repair.repair_candidates(path, directory, parallel=1)
    assert summary["failed"] == 1 and summary["repaired"] == 0 and summary["calls_started"] == 1
    saved = json.loads(path.read_text())
    assert saved["plan"][0] == frozen and len(saved["candidates"]) == 1
    assert next(iter(saved["repair_attempts"].values()))["error_class"] == "RepairValidationError"
    cite.assert_not_called(); db.assert_not_called()


def test_ingest_missing_new_inference_bool_cannot_pass_old_shape(harness):
    run, db, _, _ = harness
    path, payload, _, _, _ = run()
    directory = save_verdicts(path, payload)
    verdict_path = directory / (payload["candidates"][0]["candidate_id"] + ".json")
    raw = json.loads(verdict_path.read_text()); raw["style"].pop("inference_required")
    verdict_path.write_text(json.dumps(raw))
    with pytest.raises(click.ClickException, match="No passing candidates"):
        ingest.ingest(path, directory, dry_run=False)
    entry = json.loads(path.read_text())["candidates"][0]
    assert entry["judge_verdict"]["passed"] is False and entry["accepted"] is False
    db.assert_not_called()


@pytest.mark.parametrize("mutation", ["mode", "eligible_ids"])
def test_valid_alternate_topic_coverage_is_bound_to_frozen_request_hash(harness, mutation):
    run, db, _, _ = harness
    path, payload, _, _, _ = run()
    entry, scope = payload["candidates"][0], payload["plan"][0]
    assert scope["topic_coverage_scope"]["mode"] == "filtered"
    request_path = path.parent / entry["external_judge_request"]["path"]
    original = json.loads(request_path.read_text())
    # This is a well-formed alternate coverage context accepted by deterministic
    # scope reconstruction. It still cannot alter already frozen request policy.
    if mutation == "mode":
        scope["topic_coverage_scope"]["mode"] = "unfiltered"
        entry["topic_coverage_scope"]["mode"] = "unfiltered"
    else:
        assert scope["topic_coverage_scope"]["eligible_topic_ids"] == []
        scope["topic_coverage_scope"]["eligible_topic_ids"] = ["dataflow-streaming"]
        entry["topic_coverage_scope"]["eligible_topic_ids"] = ["dataflow-streaming"]
    assert ingest._scope(payload, entry) == scope
    changed = build_request(entry["candidate_id"], scope, candidate_question(entry), entry["sources"],
                            canonical_evidence(entry), execution_policy=payload["execution_policy"])
    assert changed["decision_provenance_sha256"] != original["decision_provenance_sha256"]
    assert set(changed) == set(original)
    with pytest.raises(ingest.CandidateValidationError, match="External request differs") as error:
        ingest._validate_candidate(path, payload, entry)
    assert error.value.stage == "external_request"
    db.assert_not_called()


def test_inline_judge_failed_draft_still_blocks_later_same_pattern_before_docs(harness, monkeypatch):
    from shared.quality_gate import JudgeVerdict
    run, db, search, _ = harness
    raw = verdict(question(), failed=True)
    judge = Mock(return_value=JudgeVerdict(False, .2, "Synthetic inference failure", "claude", gate_results=raw))
    monkeypatch.setattr(generate, "judge_three_gates", judge)
    specs = [(LIFECYCLE, question()), (LIFECYCLE, question(stem=STEM.replace("supplier", "laboratory")))]
    _, payload, result, _, writer = run(specs, flags=("--judge-model", "claude", "--dry-run"))
    assert result.exit_code == 1
    first, second = payload["candidates"]
    assert first["failure_stage"] == "judge" and first["near_duplicate_check"]["passed"]
    assert second["failure_stage"] == "answer_pattern" and second["answer_pattern_plan_check"]["matches"]
    assert first["accepted"] is False and second["accepted"] is False
    assert search.call_count == writer.call_count == judge.call_count == 1
    db.assert_not_called()


def normalized_bank():
    products = ["BigQuery"] * 16 + ["Dataflow"] * 8 + ["Cloud Storage"] * 8 + ["Dataproc"] * 8
    return [{"id": f"bank-{i}", "cert_id": "data-engineer", "stem": f"Archived legacy workflow number {i}",
             "key": f"Perform archived operation {i} with {product}",
             "distractors": [f"Alternative archived operation {i} variant {label}" for label in "xyz"],
             "answer_pattern_source": "options"} for i, product in enumerate(products)]


def test_ingest_bank_cap_vetoes_only_excess_and_persists_passer(harness, monkeypatch):
    run, db, _, _ = harness
    path, payload, result, _, _ = run(distinct_specs())
    assert result.exit_code == 0, result.output
    frozen_bank = deepcopy(payload["existing_questions"])
    requests = {p: p.read_bytes() for p in path.with_suffix(".judge-requests").glob("*.json")}
    directory = save_verdicts(path, payload)
    client = Mock()
    client.get_domain_by_code.return_value = {"id": "domain"}
    client.create_generation_run.side_effect = lambda row: {"id": row["id"]}
    client.update_generation_run.return_value = True
    monkeypatch.setattr(ingest, "database_client", Mock(return_value=client))
    persisted = []
    def persist(client, scope, question, judge, grounding, *args, **kw):
        kw["before_insert"](); kw["on_question_inserted"](kw["question_id"])
        persisted.append(question["correct_answer"])
        return True
    monkeypatch.setattr(ingest, "persist_candidate", persist)
    summary = ingest.ingest(path, directory, publication_bank=normalized_bank())
    saved = json.loads(path.read_text())
    assert summary["cap_vetoed"] == 2 and summary["complete"] == 1
    assert len(persisted) == 1 and "Dataproc" in persisted[0]
    assert [e["publication_selected"] for e in saved["candidates"]] == [False, False, True]
    assert [e.get("failure_stage") for e in saved["candidates"]] == ["product_share", "product_share", None]
    assert all(e["judge_verdict"]["passed"] for e in saved["candidates"])
    assert saved["product_share_report"]["denominator"] == 41
    assert saved["product_share_report"]["counts"]["BigQuery"] == 16
    assert saved["existing_questions"] == frozen_bank
    assert all(p.read_bytes() == original for p, original in requests.items())
    assert summary["selected_candidates"][0]["id"] == saved["candidates"][2]["inserted_question_id"]
    db.assert_not_called()


def test_ingest_product_cap_all_vetoes_is_not_an_aggregate_exception(harness):
    run, db, _, _ = harness
    path, payload, _, _, _ = run(distinct_specs()[:1])
    directory = save_verdicts(path, payload)
    summary = ingest.ingest(path, directory, dry_run=True, publication_bank=normalized_bank())
    assert summary["selected_candidates"] == [] and summary["cap_vetoed"] == 1
    saved = json.loads(path.read_text())
    assert saved["candidates"][0]["failure_stage"] == "product_share"
    db.assert_not_called()


def test_ingest_publication_overlay_adds_duplicate_gate_without_mutating_snapshot(harness, monkeypatch):
    from shared.near_duplicates import check_near_duplicate
    run, db, _, _ = harness
    path, payload, _, _, _ = run()
    directory = save_verdicts(path, payload)
    overlay = ingest.comparison_row(payload["candidates"][0]); overlay["id"] = "previous-artifact-storage-id"
    monkeypatch.setattr(ingest, "check_near_duplicate", check_near_duplicate)
    frozen = deepcopy(payload["existing_questions"])
    request_path = path.parent / payload["candidates"][0]["external_judge_request"]["path"]
    request_before = request_path.read_bytes()
    with pytest.raises(click.ClickException, match="No passing candidates"):
        ingest.ingest(path, directory, dry_run=True, publication_bank=[overlay])
    saved = json.loads(path.read_text())
    assert saved["existing_questions"] == frozen
    assert request_path.read_bytes() == request_before
    assert saved["candidates"][0]["failure_stage"] == "near_duplicate"
    assert saved["candidates"][0]["publication_selected"] is False
    db.assert_not_called()


def test_ingest_overlay_blocks_unjournaled_storage_id_before_client(harness):
    from shared.external_judge import candidate_storage_id
    run, db, _, _ = harness
    path, payload, _, _, _ = run()
    entry = payload["candidates"][0]
    overlay = ingest.comparison_row(entry)
    overlay["id"] = candidate_storage_id(entry, ingest._scope(payload, entry), candidate_question(entry))
    directory = save_verdicts(path, payload)
    before = path.read_bytes()
    with pytest.raises(click.ClickException, match="unjournaled candidate"):
        ingest.ingest(path, directory, publication_bank=[overlay])
    assert path.read_bytes() == before
    db.assert_not_called()


@pytest.mark.parametrize("mutation", ["duplicate_id", "wrong_cert", "missing_distractors"])
def test_ingest_overlay_rejects_malformed_rows_before_client(harness, mutation):
    run, db, _, _ = harness
    path, payload, _, _, _ = run()
    directory = save_verdicts(path, payload)
    rows = normalized_bank()
    if mutation == "duplicate_id": rows.append(deepcopy(rows[0]))
    if mutation == "wrong_cert": rows[0]["cert_id"] = "machine-learning-engineer"
    if mutation == "missing_distractors": rows[0].pop("distractors")
    with pytest.raises(click.ClickException, match="Malformed publication bank"):
        ingest.ingest(path, directory, dry_run=True, publication_bank=rows)
    db.assert_not_called()


def mark_complete(path, index):
    payload = json.loads(path.read_text())
    entry = payload["candidates"][index]
    entry.update(persistence_status="complete", inserted_question_id=entry["candidate_id"],
                 accepted=True, status="persisted")
    code = entry["domain_code"]; run_id = ingest._run_id(payload, code)
    payload["generation_runs"][code] = run_id
    payload["external_run_journal"] = {code: {"status": "created", "run_id": run_id}}
    path.write_text(json.dumps(payload))
    return deepcopy(entry["option_balance"])


def test_ingest_cap_preserves_legacy_completed_balance_cohort_across_replays(harness):
    run, db, _, _ = harness
    path, payload, _, _, _ = run(distinct_specs())
    directory = save_verdicts(path, payload)
    ingest.ingest(path, directory, dry_run=True)
    original = mark_complete(path, 0)
    for _ in range(2):
        summary = ingest.ingest(path, directory, dry_run=True, publication_bank=normalized_bank())
        saved = json.loads(path.read_text())
        assert summary["cap_vetoed"] == 1 and len(summary["selected_candidates"]) == 1
        assert saved["candidates"][0]["option_balance"] == original
        assert saved["candidates"][1]["failure_stage"] == "product_share"
        assert saved["candidates"][2]["publication_selected"] is True
        ingest.validate_completed_journals(saved, path)
    db.assert_not_called()


def test_ingest_cap_preserves_new_selected_completed_balance_cohort_across_replays(harness):
    run, db, _, _ = harness
    path, payload, _, _, _ = run(distinct_specs())
    directory = save_verdicts(path, payload)
    summary = ingest.ingest(path, directory, dry_run=True, publication_bank=normalized_bank())
    assert summary["cap_vetoed"] == 2
    original = mark_complete(path, 2)
    for _ in range(2):
        summary = ingest.ingest(path, directory, dry_run=True, publication_bank=normalized_bank())
        saved = json.loads(path.read_text())
        assert summary["cap_vetoed"] == 2 and summary["selected_candidates"] == []
        assert saved["candidates"][2]["option_balance"] == original
        ingest.validate_completed_journals(saved, path)
    db.assert_not_called()


def test_inline_product_cap_ranks_passed_above_higher_score_failed_draft(harness, monkeypatch):
    from shared.quality_gate import JudgeVerdict
    run, db, _, tmp_path = harness
    rows = normalized_bank()
    rows[15]["key"] = "Perform archived operation15 with Dataflow"
    exported = [{"id": row["id"], "cert_id": row["cert_id"], "status": "ACTIVE", "stem": row["stem"], "key": "A",
                 "options": [{"label": label, "text": text}
                             for label, text in zip("ABCD", [row["key"], *row["distractors"]])]} for row in rows]
    bank = tmp_path / "inline-bank.json"; bank.write_text(json.dumps(exported))
    judges = [JudgeVerdict(True, .8, "Synthetic passing quality review", "claude", gate_results=verdict(question())),
              JudgeVerdict(False, .95, "Synthetic failed style despite high score", "claude", gate_results=verdict(question(), failed=True))]
    monkeypatch.setattr(generate, "judge_three_gates", Mock(side_effect=judges))
    _, payload, result, _, _ = run(distinct_specs()[:2], flags=("--judge-model", "claude", "--dry-run", "--existing-questions", str(bank)))
    assert result.exit_code == 1  # The failed judge is still a failure, never promoted.
    first, second = payload["candidates"]
    assert first["judge_verdict"]["passed"] and first["publication_selected"]
    assert not second["judge_verdict"]["passed"] and not second["publication_selected"]
    assert second["failure_stage"] == "product_share"
    assert payload["product_share_report"]["denominator"] == 41
    db.assert_not_called()
