"""Synthetic offline artifact contracts; no real corpus question text."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import tempfile
from unittest.mock import Mock

import pytest

from scripts.optimize import build_datasets as datasets
from shared.argon_gate import build_argon_request
from shared.external_judge import build_request, candidate_id, canonical_sha256
from shared.gates import blind_choice_map, gate_signatures
from shared.option_order import store_options


@pytest.fixture
def tmp_path():
    root = Path(__file__).resolve().parents[1] / ".cache/optimize-dataset-tests"
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root) as folder:
        yield Path(folder)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    forbidden = Mock(side_effect=AssertionError("No models, DB, dotenv or external retrieval"))
    monkeypatch.setattr("dspy.LM", forbidden)
    monkeypatch.setattr("dotenv.load_dotenv", forbidden)
    monkeypatch.setattr("shared.argon_gate.run_call", forbidden)
    monkeypatch.setattr("shared.cli_models.run_signature", forbidden)
    monkeypatch.setattr("shared.doc_search.search_objective_docs", forbidden)


def artifact(folder, number=1, *, version=3, passing=True, cohort=None, stem=None):
    ident = f"machine-learning-engineer:standard:1.1:{number}"
    scope = {"objective_id": ident, "domain_code": "machine-learning-engineer:standard:1",
             "cert_id": "machine-learning-engineer", "subsection": "1.1", "guide_sha256": "a" * 64,
             "objective_text": f"Synthetic objective {number}", "domain_prompt": f"Synthetic scope {number}"}
    plan = {"objective_id": ident, "engineering_decision": "Choose synthetic action",
            "business_consequence": "A synthetic business need", "existing_system": "Synthetic system",
            "decisive_constraints": ["Keep synthetic constraint"], "best_action": "Synthetic key action",
            "mistakes": [{"action": f"Synthetic alternate {n}", "scenario_reason": f"Synthetic losing reason {n}"} for n in range(3)]}
    text = "Synthetic source states documented behavior for all options."
    url = "https://docs.cloud.google.com/vertex-ai/docs/start/introduction-unified-platform"
    sources = [{"url": url, "requested_url": url, "text": text,
                "text_sha256": hashlib.sha256(text.encode()).hexdigest(), "retrieved_at": "2026-01-01T00:00:00Z"}]
    receipts = [{"option_label": label, "url": url, "quote": "documented behavior"} for label in "ABCD"]
    proof = {**{flag: passing for flag in datasets.FLAGS}, "reason": "Synthetic recorded reason",
             "reasons": [{**r, "scenario_reason": "Synthetic scenario reason"} for r in receipts] if passing else [],
             "passed": passing, "mechanical_check": {"passed": passing, "errors": [] if passing else ["missing receipts"]}}
    question = {field: f"Synthetic {field} {number}" for field in datasets.QUESTION_FIELDS}
    question["stem"] = stem or f"Synthetic application {number} needs a decision. What should you do?"
    candidate = candidate_id(1, scope, question)
    entry = {"index": 1, "candidate_id": candidate, "objective_id": ident, "domain_code": scope["domain_code"],
             "accepted": True, "decision_plan": plan, "decision_proof": proof, "sources": sources,
             "stem": question["stem"], "decision_attempts": [{"attempt": 1, "plan": plan, "proof": proof,
             "sources": sources, "replacement_feedback": "", "existing_scenarios": []}]}
    store_options(entry, question, receipts)
    request = build_request(candidate, scope, question, sources, receipts,
                            gate_version=5, argon_gate=True, execution_policy="short_circuit_v2")
    if version != 3:
        request["argon"] = build_argon_request(question, scope, "Synthetic context", receipts,
                                               version=version, review_only=version == 2)
    choice = next(k for k, v in blind_choice_map(question).items() if v == "A")
    blind = {"verdict": "PASS", "choice": choice, "confidence": .95,
             "ambiguous_answers": False, "reason": "Synthetic key reasoning"}
    raw = {"blind_solver": blind}
    for name in ("style", "evidence"):
        signature = gate_signatures(5)[name]
        raw[name] = {key: (True if field.annotation is bool else .95 if key == "score" else
                          "PASS" if key == "verdict" else "Synthetic seat reason")
                     for key, field in signature.output_fields.items()}
        if name == "style":
            raw[name]["generic_validation_key"] = False
    raw["argon"] = {"model": "openrouter/google/gemini-4-argon", "version": version,
                    "request_sha256": canonical_sha256(request["argon"]),
                    "review": {"verdict": "PASS", "key_correct": True, "other_defensible_option": False,
                               "issues": [], "fix": "No changes needed"}}
    if version != 2:
        raw["argon"]["blind"] = blind
    entry["external_verdict"] = raw
    path = folder / f"artifact-{number}.json"
    request_dir = path.with_suffix(".judge-requests")
    request_dir.mkdir(parents=True)
    request_path = request_dir / (candidate + ".json")
    request_path.write_text(json.dumps(request))
    entry["external_judge_request"] = {"path": str(request_path.relative_to(path.parent)),
                                       "sha256": hashlib.sha256(request_path.read_bytes()).hexdigest()}
    payload = {"plan": [scope], "candidates": [entry], "difficulty": "MEDIUM", "rules_version": 5}
    if cohort:
        payload["cohort"] = cohort
    path.write_text(json.dumps(payload))
    return path, payload


def save(path, payload):
    path.write_text(json.dumps(payload))


def records(folder, stage):
    return [row for split in datasets.SPLITS for row in json.loads((folder / f"{stage}.{split}.json").read_text())]


def test_splits_deterministic_objective_disjoint_and_production_fields(tmp_path):
    inputs = tmp_path / "inputs"
    inputs.mkdir()
    paths = [artifact(inputs, n)[0] for n in range(1, 11)]
    first = datasets.build_datasets(paths, tmp_path / "one", 17)
    second = datasets.build_datasets(list(reversed(paths)), tmp_path / "two", 17)
    assert first == second
    groups = [set(first["splits"][s]) for s in datasets.SPLITS]
    assert all(not groups[i] & groups[j] for i in range(3) for j in range(i))
    assert sum(first["counts"]["plan"].values()) == 10
    assert sum(first["counts"]["draft"].values()) == 10
    for stage in ("plan", "draft"):
        for split in datasets.SPLITS:
            assert (tmp_path / "one" / f"{stage}.{split}.json").read_bytes() == (tmp_path / "two" / f"{stage}.{split}.json").read_bytes()
            assert all(row["objective_id"] in first["splits"][split] for row in json.loads((tmp_path / "one" / f"{stage}.{split}.json").read_text()))
    plan = records(tmp_path / "one", "plan")[0]
    assert set(plan["inputs"]) == {"objective_scope", "difficulty", "replacement_feedback", "existing_scenarios"}
    assert set(plan["outputs"]) == {"plan"}
    draft = records(tmp_path / "one", "draft")[0]
    assert set(draft["inputs"]) == {"domain_context", "documentation_context", "difficulty", "exam_subsection", "gap_analysis_guidance"}
    assert set(draft["outputs"]) == set(datasets.QUESTION_FIELDS) | {"evidence"}
    assert [r["option_label"] for r in draft["outputs"]["evidence"]] == list("ABCD")
    assert draft["outputs"]["correct_answer"].startswith("Synthetic correct_answer")
    assert "Verified decision plan" in draft["inputs"]["domain_context"]


@pytest.mark.parametrize("version, expected", [(1, 1), (2, 0), (3, 1)])
def test_requires_all_five_council_seats(tmp_path, version, expected):
    path, _ = artifact(tmp_path, version=version)
    manifest = datasets.build_datasets([path], tmp_path / "out")
    assert sum(manifest["counts"]["draft"].values()) == expected
    if expected:
        assert records(tmp_path / "out", "draft")[0]["council"]["argon_version"] == version


@pytest.mark.parametrize("mutation", ["missing_seat", "empty", "skipped", "string_bool", "false_check", "fail_verdict", "bad_argon", "bad_request", "bad_receipt", "false_acceptance", "changed_question"])
def test_fail_closed_draft_acceptance(tmp_path, mutation):
    path, payload = artifact(tmp_path)
    entry = payload["candidates"][0]
    raw = entry["external_verdict"]
    if mutation == "missing_seat":
        del raw["evidence"]
    elif mutation == "empty":
        raw["style"] = {}
    elif mutation == "skipped":
        raw["blind_solver"] = {"status": "skipped"}
    elif mutation == "string_bool":
        raw["evidence"]["correct_answer_accurate"] = "true"
    elif mutation == "false_check":
        raw["evidence"]["correct_answer_accurate"] = False
    elif mutation == "fail_verdict":
        raw["style"]["verdict"] = "FAIL"
    elif mutation == "bad_argon":
        raw["argon"]["review"]["other_defensible_option"] = True
    elif mutation == "bad_request":
        entry["external_judge_request"]["sha256"] = "0" * 64
    elif mutation == "bad_receipt":
        entry["evidence"][0]["quote"] = "not in source"
    elif mutation == "changed_question":
        entry["stem"] = "Altered after the frozen council verdict"
    else:
        entry["accepted"] = "true"
    save(path, payload)
    manifest = datasets.build_datasets([path], tmp_path / "out")
    assert sum(manifest["counts"]["draft"].values()) == 0


def test_rejected_plan_attempts_keep_feedback_but_not_draft(tmp_path):
    path, _ = artifact(tmp_path, passing=False)
    manifest = datasets.build_datasets([path], tmp_path / "out")
    assert sum(manifest["counts"]["plan"].values()) == 1
    row = records(tmp_path / "out", "plan")[0]
    assert row["proof"]["passed"] is False
    assert row["proof"]["reason"] == "Synthetic recorded reason"
    assert sum(manifest["counts"]["draft"].values()) == 0


@pytest.mark.parametrize("field", ["replacement_feedback", "existing_scenarios", "proof", "sources"])
def test_missing_plan_fields_never_invented(tmp_path, field):
    path, payload = artifact(tmp_path)
    del payload["candidates"][0]["decision_attempts"][0][field]
    save(path, payload)
    manifest = datasets.build_datasets([path], tmp_path / "out")
    assert sum(manifest["counts"]["plan"].values()) == 0


def test_cohort_holds_entire_objective_and_never_uses_mutated_rows(tmp_path):
    paths = [artifact(tmp_path, n)[0] for n in range(1, 11)]
    _, original = artifact(tmp_path / "monitor", 1, cohort="gold")
    monitor = tmp_path / "monitor" / "manifest.json"
    monitor.write_text(json.dumps({"kind": "canaries", "rows": [{"scope": original["plan"][0]}]}))
    manifest = datasets.build_datasets(paths, tmp_path / "out", cohort_paths=[monitor])
    ident = original["plan"][0]["objective_id"]
    assert ident in manifest["splits"]["test"]
    assert ident in manifest["excluded_train_objectives"]
    assert all(row["objective_id"] != ident for row in json.loads((tmp_path / "out" / "draft.train.json").read_text()))


def test_cross_objective_duplicate_stem_and_scenario_hints_do_not_leak(tmp_path):
    paths = [artifact(tmp_path, n)[0] for n in range(1, 11)]
    initial = datasets.build_datasets(paths, tmp_path / "initial")
    train_id, test_id = initial["splits"]["train"][0], initial["splits"]["test"][0]
    by_id = {json.loads(p.read_text())["plan"][0]["objective_id"]: p for p in paths}
    test_payload = json.loads(by_id[test_id].read_text())
    target_stem = test_payload["candidates"][0]["stem"]
    train_payload = json.loads(by_id[train_id].read_text())
    # Rebuild a valid candidate/request with an identical stem on a different objective.
    number = int(train_id.rsplit(":", 1)[1])
    by_id[train_id].with_suffix(".judge-requests").rename(tmp_path / "old-request")
    artifact(tmp_path, number, stem=target_stem.upper())
    result = datasets.build_datasets(paths, tmp_path / "out")
    assert result["filters"]["cross_split_text_filtered"] >= 2
    assert all(row["objective_id"] != train_id for row in json.loads((tmp_path / "out" / "draft.train.json").read_text()))
    other_id = initial["splits"]["train"][1]
    other = json.loads(by_id[other_id].read_text())
    other["candidates"][0]["decision_attempts"][0]["existing_scenarios"] = [{"stem": target_stem}]
    save(by_id[other_id], other)
    result = datasets.build_datasets(paths, tmp_path / "with-hints")
    assert all(row["objective_id"] != other_id for row in json.loads((tmp_path / "with-hints" / "plan.train.json").read_text()))


def test_malformed_json_and_inconsistent_proof_fail_closed(tmp_path):
    path, payload = artifact(tmp_path)
    payload["candidates"][0]["decision_attempts"][0]["proof"]["supported"] = False
    save(path, payload)
    broken = tmp_path / "broken.json"
    broken.write_text('{"candidates": [')
    manifest = datasets.build_datasets([path, broken], tmp_path / "out")
    assert manifest["filters"]["malformed_artifacts"] == 1
    assert sum(manifest["counts"]["plan"].values()) == 0


def test_duplicate_json_keys_not_accepted(tmp_path):
    path = tmp_path / "broken.json"
    path.write_text('{"candidates": [], "accepted": false, "accepted": true}')
    result = datasets.build_datasets([path], tmp_path / "out")
    assert result["filters"]["malformed_artifacts"] == 1


@pytest.mark.parametrize("recorded_field", [True, False])
def test_option_local_repair_signature_not_silently_treated_as_normal_plan(tmp_path, recorded_field):
    path, payload = artifact(tmp_path)
    attempt = payload["candidates"][0]["decision_attempts"][0]
    if recorded_field:
        attempt["repair_options"] = ["B"]
    else:
        attempt["replacement_feedback"] = json.dumps({"repair_options": ["B"], "frozen_plan": attempt["plan"]})
    save(path, payload)
    result = datasets.build_datasets([path], tmp_path / "out")
    assert sum(result["counts"]["plan"].values()) == 0
    assert result["filters"]["excluded_option_local_repairs"] == 1
