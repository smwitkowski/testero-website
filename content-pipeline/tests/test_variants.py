"""Synthetic replay tests: no claims about live variant quality or token savings."""
from copy import deepcopy
import hashlib
import json
from unittest.mock import Mock

import pytest
from scripts import generate_variants as variants, ingest_external_verdicts as ingest
from shared.cert_context import plan_questions, DEFAULT_CERT
from shared.external_judge import candidate_id, candidate_question, build_request, canonical_sha256
from shared.option_order import store_options, canonical_evidence
from shared.variants import (parent_snapshot, validate_variant, variant_duplicates, lineage,
                             writer_inputs, render_prompt)
from test_generation_gate import QUESTION, URL, TEXT, QUOTES
from test_three_gates_v4 import bundle


@pytest.fixture
def parents(tmp_path, monkeypatch):
    monkeypatch.setattr("shared.cli_models.run_signature", Mock(side_effect=AssertionError("No live CLI")))
    monkeypatch.setattr("dspy.LM", Mock(side_effect=AssertionError("No live LM")))
    scope = plan_questions(DEFAULT_CERT, 1, objective_ids=["machine-learning-engineer:standard:4.1:1"])[0]
    proof = {"passed": True, "supported": True, "uniquely_best": True,
             "scenario_reasons_supported": True, "no_feature_gotchas": True,
             "reason": "Synthetic proof only", "mechanical_check": {"passed": True, "errors": []},
             "reasons": [{"option_label": label, "url": URL, "quote": quote,
                          "scenario_reason": "Synthetic failure mechanism"} for label, quote in zip("ABCD", QUOTES)]}
    scope.update(decision_objective={"objective_id": scope["objective_id"], "objective_text": scope["objective_text"]},
                 decision_plan={"objective_id": scope["objective_id"], "engineering_decision": "Choose managed serving",
                    "business_consequence": "Reliable HTTP responses", "existing_system": "Order tracking",
                    "decisive_constraints": ["Minimize upkeep"], "best_action": QUESTION["correct_answer"],
                    "mistakes": [{"action": QUESTION[k], "scenario_reason": "Synthetic mismatch"}
                                 for k in ("distractor_1", "distractor_2", "distractor_3")]}, decision_proof=proof)
    sources = [{"requested_url": URL, "url": URL, "text": TEXT,
                "retrieved_at": "2026-10-04T00:00:00+00:00", "text_sha256": hashlib.sha256(TEXT.encode()).hexdigest()}]
    from shared.evidence import check_evidence
    evidence = check_evidence([{k: row[k] for k in ("option_label", "url", "quote")} for row in proof["reasons"]], sources)["options"]
    ident = candidate_id(1, scope, QUESTION)
    entry = {**deepcopy(scope), "index": 1, "candidate_id": ident, "stem": QUESTION["stem"], "sources": sources,
             "accepted": True, "persistence_status": "complete", "inserted_question_id": ident,
             "judge_verdict": {"passed": True}, "external_verdict": bundle(QUESTION)}
    store_options(entry, QUESTION, evidence)
    payload = {"cert_id": DEFAULT_CERT, "model": "codex", "rules_version": 5, "external_judge_version": 2,
               "argon_gate": False, "execution_policy": None, "plan": [scope], "candidates": [entry],
               "style_policy_version": "5.1"}
    from scripts.ingest_external_verdicts import _run_id
    code = scope["domain_code"]
    payload["generation_runs"] = {code: _run_id(payload, code)}
    payload["external_run_journal"] = {code: {"status": "created", "run_id": payload["generation_runs"][code]}}
    request = build_request(ident, scope, QUESTION, sources, evidence, gate_version=5)
    folder = tmp_path / "requests"; folder.mkdir()
    request_path = folder / (ident + ".json")
    request_path.write_text(json.dumps(request))
    entry["external_judge_request"] = {"path": "requests/" + request_path.name,
        "sha256": hashlib.sha256(request_path.read_bytes()).hexdigest()}
    bank = [{"id": ident, "status": "ACTIVE", "stem": entry["stem"], "key": entry["key"],
             "options": entry["options"], "rationales": entry["rationales"]}]
    artifact = tmp_path / "parents.json"; artifact.write_text(json.dumps(payload))
    export = tmp_path / "bank.json"; export.write_text(json.dumps(bank))
    return artifact, export, payload, bank


VARIANT = {**QUESTION, "stem": "Your company operates a museum archive that identifies damaged manuscripts from visitor photographs. "
    "Curators submit images through a web endpoint during exhibition openings, creating bursts of traffic. "
    "The archive has packaged its image classifier as a container and wants the engineering staff focused on collection quality instead of maintaining infrastructure. "
    "Which approach should you use?", "industry": "museum archives", "setting": "Photograph damage classification"}


def generate(parents, tmp_path, **kwargs):
    artifact, export, payload, _ = parents
    return variants.generate([artifact], [payload["candidates"][0]["candidate_id"]], export,
        tmp_path / "variants.json", variants_per_parent=1, **kwargs)


def test_default_dry_run_renders_without_any_model_database_or_retrieval(parents, tmp_path, monkeypatch):
    monkeypatch.setattr(variants, "write_variant", Mock(side_effect=AssertionError("No writer")))
    monkeypatch.setattr("scripts.generate_pmle_questions.database_client", Mock(side_effect=AssertionError("No DB")))
    monkeypatch.setattr("shared.doc_search.search_objective_docs", Mock(side_effect=AssertionError("No retrieval")))
    result = generate(parents, tmp_path)
    assert result["dry_run"]["writer_calls"] == 1
    assert result["dry_run"]["plan_calls"] == result["dry_run"]["verify_calls"] == 0
    assert result["dry_run"]["estimated_writer_input_tokens"] > 0
    assert not result["candidates"]
    with pytest.raises(ValueError): generate(parents, tmp_path)


@pytest.mark.parametrize("defect", ["draft", "unaccepted", "partial", "changed_option", "failed_proof", "failed_judge", "invalid_receipt", "run", "rationale"])
def test_parent_restrictions_fail_closed(parents, defect):
    _, _, payload, bank = parents
    entry = payload["candidates"][0]
    if defect == "draft": bank[0]["status"] = "DRAFT"
    elif defect == "unaccepted": entry["accepted"] = False
    elif defect == "partial": entry["persistence_status"] = "inserted"
    elif defect == "changed_option": bank[0]["options"][0]["text"] = "Unsupported new alternative"
    elif defect == "failed_proof": entry["decision_proof"]["supported"] = False
    elif defect == "failed_judge": entry["external_verdict"]["evidence"]["evidence_supported"] = False
    elif defect == "run": payload["external_run_journal"] = {}
    elif defect == "rationale": bank[0]["rationales"]["A"] = "Changed rationale"
    else: entry["evidence"][0]["quote"] = "Not fetched"
    with pytest.raises(ValueError): parent_snapshot(payload, entry, bank)


def test_one_writer_frozen_evidence_requests_blind_isolation_and_ingest(parents, tmp_path):
    calls = []
    result = generate(parents, tmp_path, enable_variants=True,
                      predictor=lambda inputs: calls.append(inputs) or deepcopy(VARIANT))
    assert len(calls) == 1
    entry = result["candidates"][0]
    assert entry.get("failure_stage") is None, entry
    validate_variant(result, entry)
    parent = result["variant_parents"][entry["parent_question_id"]]
    assert canonical_evidence(entry) == parent["evidence"]
    request = json.loads((tmp_path / entry["external_judge_request"]["path"]).read_text())
    assert request["argon"]["version"] == 2
    assert "VARIANT INVARIANTS" in request["gates"]["evidence"]["judge_prompt"]
    assert "VARIANT INVARIANTS" in request["argon"]["calls"]["review"]["judge_prompt"]
    assert "VARIANT INVARIANTS" not in request["gates"]["blind_solver"]["judge_prompt"]
    scope, question, checked = ingest._validate_candidate(tmp_path / "variants.json", result, entry)
    assert question == {k: VARIANT[k] for k in QUESTION}
    assert checked["passed"]


@pytest.mark.parametrize("defect", ["decision", "sources", "receipts", "parent_hash", "origin", "no_argon", "strip_lineage"])
def test_ingest_blocks_changed_lineage_before_judging(parents, tmp_path, defect):
    result = generate(parents, tmp_path, enable_variants=True, predictor=lambda _: deepcopy(VARIANT))
    entry = result["candidates"][0]
    if defect == "decision": entry["decision_plan"]["best_action"] += " changed"
    elif defect == "sources": entry["sources"][0]["text"] += " changed"
    elif defect == "receipts": entry["evidence"][0]["option_label"] = entry["evidence"][1]["option_label"]
    elif defect == "parent_hash": entry["variant"]["parent_snapshot_sha256"] = "0" * 64
    elif defect == "origin": entry["variant"]["ordinal"] = 2
    elif defect == "no_argon": result["argon_gate"] = False
    else: del entry["variant"]; del entry["parent_question_id"]
    with pytest.raises(ValueError): ingest._validate_candidate(tmp_path / "variants.json", result, entry)


def test_parent_only_similarity_exception_bank_and_siblings_remain_strict(parents, tmp_path):
    result = generate(parents, tmp_path, enable_variants=True, predictor=lambda _: deepcopy(VARIANT))
    entry = result["candidates"][0]; parent = result["variant_parents"][entry["parent_question_id"]]
    assert variant_duplicates(entry, [], parent)["passed"]
    from shared.near_duplicates import comparison_row
    assert not variant_duplicates(entry, [{**comparison_row(entry), "id": "other-bank-question"}], parent)["passed"]
    renamed = deepcopy(parent["entry"])
    renamed["candidate_id"] = entry["candidate_id"]
    renamed["stem"] = renamed["stem"].replace("retailer", "museum")
    assert not variant_duplicates(renamed, [], parent)["passed"]


def test_writer_preserves_parent_avoidance_hints_and_receipt_binding(parents):
    _, _, payload, bank = parents
    parent = parent_snapshot(payload, payload["candidates"][0], bank)
    plan, assignments = variants.build_plan([parent], 3)
    assert len(plan) == 3
    assert len({s["scenario_moment"] for s in plan}) == len({s["opening_style"] for s in plan}) == 3
    for index, _, ordinal in assignments:
        inputs = writer_inputs(parent, plan[index - 1], [], ordinal, "MEDIUM")
        assert json.loads(inputs["parent_question"])["canonical_option_receipts"] == parent["evidence"]
        assert "Different industry" in render_prompt(inputs)


def verdict_for(entry, tmp_path):
    from shared.argon_gate import MODEL
    question = candidate_question(entry)
    raw = bundle(question)
    request = json.loads((tmp_path / entry["external_judge_request"]["path"]).read_text())
    raw["argon"] = {"model": MODEL, "version": 2, "request_sha256": canonical_sha256(request["argon"]),
        "review": {"verdict": "PASS", "key_correct": True, "other_defensible_option": False,
                   "issues": [], "fix": "No changes needed"}}
    folder = tmp_path / "variants.verdicts"; folder.mkdir()
    (folder / (entry["candidate_id"] + ".json")).write_text(json.dumps(raw))
    return folder


def test_report_counts_all_attempt_tokens_and_missing_usage(parents, tmp_path):
    from scripts.variants_ab import report
    payload = generate(parents, tmp_path, enable_variants=True, predictor=lambda _: deepcopy(VARIANT))
    entry = payload["candidates"][0]
    verdicts = verdict_for(entry, tmp_path)
    calls = tmp_path / "variants.json.calls.jsonl"
    rows = [{"stage": "variant_write", "input_tokens": 100, "output_tokens": 50},
            {"stage": "judge_evidence", "input_tokens": 5, "output_tokens": 3, "ok": False},
            {"stage": "judge_style", "input_tokens": 5, "output_tokens": 3},
            {"stage": "judge_blind", "input_tokens": 5, "output_tokens": 3},
            {"stage": "argon_review", "input_tokens": 4, "output_tokens": 2}]
    calls.write_text("\n".join(json.dumps(r) for r in rows))
    result = report(tmp_path / "variants.json", verdicts)
    assert result["all_gate_passed"] == 1, result
    assert result["tokens"]["tokens_per_gate_pass"] == 180
    assert result["blind_solver_accuracy"]["rate"] == 1
    assert result["argon_revise"]["rate"] == 0
    assert len(result["human_review_pairs"]) == 1
    rows.append({"stage": "judge_argon_review", "input_tokens": None, "output_tokens": None})
    calls.write_text("\n".join(json.dumps(r) for r in rows))
    result = report(tmp_path / "variants.json", verdicts)
    assert result["tokens"]["tokens_per_gate_pass"] is None
    assert result["tokens"]["known_input_output"] == 180
    assert not result["tokens"]["complete_usage"]


def test_ingest_dry_run_retains_grounding_lineage_and_rebalanced_evidence(parents, tmp_path, monkeypatch):
    client = Mock(side_effect=AssertionError("No database"))
    monkeypatch.setattr(ingest, "database_client", client)
    payload = generate(parents, tmp_path, enable_variants=True, predictor=lambda _: deepcopy(VARIANT))
    entry = payload["candidates"][0]
    verdicts = verdict_for(entry, tmp_path)
    ingest.ingest(tmp_path / "variants.json", verdicts, dry_run=True)
    saved = json.loads((tmp_path / "variants.json").read_text())["candidates"][0]
    assert saved["grounding"]["parent_question_id"] == entry["parent_question_id"]
    assert saved["grounding"]["variant"] == entry["variant"]
    assert saved["grounding"]["evidence"] == saved["evidence"]
    assert saved["option_balance"]["index"] == 0
    assert saved["accepted"] is False
    client.assert_not_called()


@pytest.mark.parametrize("defect", ["missing_request", "request_hash", "run_journal"])
def test_selection_rechecks_original_frozen_request_and_run(parents, tmp_path, defect):
    artifact, export, payload, _ = parents
    entry = payload["candidates"][0]
    if defect == "missing_request":
        (tmp_path / entry["external_judge_request"]["path"]).unlink()
    elif defect == "request_hash":
        entry["external_judge_request"]["sha256"] = "0" * 64
    else:
        payload["external_run_journal"][entry["domain_code"]]["status"] = "pending"
    artifact.write_text(json.dumps(payload))
    with pytest.raises(ValueError):
        variants.select_parents([artifact], [entry["candidate_id"]], export)


def test_request_export_retains_variant_context_and_binding(parents, tmp_path):
    from scripts.export_judge_requests import export_requests
    payload = generate(parents, tmp_path, enable_variants=True, predictor=lambda _: deepcopy(VARIANT))
    entry = payload["candidates"][0]
    original = (tmp_path / entry["external_judge_request"]["path"]).read_bytes()
    export_requests(tmp_path / "variants.json")
    assert (tmp_path / entry["external_judge_request"]["path"]).read_bytes() == original
