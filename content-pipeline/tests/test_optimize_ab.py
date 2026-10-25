"""Offline A/B assignment, generation-only isolation, artifact/digest and statistics."""
from copy import deepcopy
from datetime import datetime, timezone
import json
import math
from pathlib import Path

from click.testing import CliRunner
import pytest

from shared.ab_experiment import generation_call, interleave_plan
from shared.batch_report import ab_arm_report
from scripts.optimize import ab_report
from scripts.optimize.ab_report import GUARDRAILS, paired_statistics, summarize
from scripts.optimize.evaluate_pack import SEATS

DIGEST = "a" * 64


def scopes():
    return [{"objective_id": "x", "index_hint": 1}, {"objective_id": "y", "index_hint": 2},
            {"objective_id": "x", "index_hint": 3}]


def assignments(seed=0, cohort="batch"):
    return interleave_plan(scopes(), experiment="trial", seed=seed, pack_sha256=DIGEST, cohort=cohort)


def test_interleaving_is_paired_stratified_frozen_and_reproducible():
    original = scopes()
    plan = interleave_plan(original, experiment="trial", seed=2, pack_sha256=DIGEST)
    assert plan == interleave_plan(original, experiment="trial", seed=2, pack_sha256=DIGEST)
    assert len(plan) == 6 and original == scopes()
    for first, second in zip(plan[::2], plan[1::2]):
        assert first["objective_id"] == second["objective_id"]
        a, b = first["ab_assignment"], second["ab_assignment"]
        assert a["pair_id"] == b["pair_id"]
        assert {a["arm"], b["arm"]} == {"control", "challenger"}
        assert {a["prompt_pack_sha256"], b["prompt_pack_sha256"]} == {None, DIGEST}
    assert len({row["ab_assignment"]["pair_id"] for row in plan}) == 3
    assert assignments(cohort="a") != assignments(cohort="b")
    assert assignments(seed=1) != assignments(seed=2)
    plan[0]["index_hint"] = -1
    assert original[0]["index_hint"] == 1


def test_pair_order_does_not_always_favor_one_arm():
    first = [assignments(seed)[0]["ab_assignment"]["arm"] for seed in range(50)]
    assert set(first) == {"control", "challenger"}


@pytest.mark.parametrize("experiment,seed,digest", [("", 0, DIGEST), ("bad/id", 0, DIGEST), ("ok", True, DIGEST), ("ok", 0, "bad")])
def test_invalid_assignment_inputs_rejected(experiment, seed, digest):
    with pytest.raises(ValueError):
        interleave_plan(scopes(), experiment=experiment, seed=seed, pack_sha256=digest)


def test_pack_never_leaks_to_control_proof_or_judges():
    from shared import prompt_pack
    pack = prompt_pack.create_pack(stage="plan", policy={}, source_run="offline", scores={})
    def writer():
        return prompt_pack._ACTIVE.get()
    def proof():
        return prompt_pack._ACTIVE.get()
    with prompt_pack.use_prompt_pack(pack):
        assert generation_call(writer, prompt_pack=None, writer_functions=(writer,)) is None
        assert generation_call(writer, prompt_pack=pack, writer_functions=(writer,)) == pack
        assert generation_call(proof, prompt_pack=pack, writer_functions=(writer,)) is None
        assert prompt_pack._ACTIVE.get() == pack
    assert prompt_pack._ACTIVE.get() is None


def pack_file(tmp_path):
    from shared.prompt_pack import create_pack, save_pack
    path = tmp_path / "pack.json"
    save_pack(create_pack(stage="plan", policy={}, source_run="offline", scores={}), path)
    return path


def test_generator_offline_plan_records_equal_objective_arms(tmp_path, monkeypatch):
    from scripts import generate_pmle_questions as gen
    monkeypatch.setattr(gen, "ARTIFACT_ROOT", tmp_path)
    path = tmp_path / "batch.json"
    args = ["--n-questions", "8", "--model", "codex", "--judge-model", "external",
            "--argon-gate", "--plan-only", "--artifact", str(path), "--prompt-pack", str(pack_file(tmp_path)),
            "--ab-interleaved", "--ab-experiment", "trial", "--ab-seed", "7"]
    result = CliRunner().invoke(gen.main, args)
    assert result.exit_code == 0, result.output
    data = json.loads(path.read_text())
    assert len(data["plan"]) == data["planned_count"] == 8
    assert data["ab_experiment"]["generation_only"] is True
    for first, second in zip(data["plan"][::2], data["plan"][1::2]):
        assert first["objective_id"] == second["objective_id"]
        assert first["ab_assignment"]["arm"] != second["ab_assignment"]["arm"]


@pytest.mark.parametrize("flags", [["--n-questions", "3"], ["--judge-model", "claude"], ["--section-allocation", "2,2"]])
def test_generator_rejects_unsafe_ab_before_work(tmp_path, monkeypatch, flags):
    from scripts import generate_pmle_questions as gen
    monkeypatch.setattr(gen, "ARTIFACT_ROOT", tmp_path)
    args = ["--n-questions", "4", "--model", "codex", "--judge-model", "external", "--argon-gate",
            "--artifact", str(tmp_path / "batch.json"), "--prompt-pack", str(pack_file(tmp_path)),
            "--ab-interleaved", "--ab-experiment", "trial", *flags]
    result = CliRunner().invoke(gen.main, args)
    assert result.exit_code == 1
    assert not (tmp_path / "batch.json").exists()


def test_real_generation_records_arms_on_early_veto_and_never_rotates(tmp_path, monkeypatch):
    from scripts import generate_pmle_questions as gen
    from shared import prompt_pack
    monkeypatch.setattr(gen, "ARTIFACT_ROOT", tmp_path)
    seen = []
    def veto(scope, **kwargs):
        seen.append((scope["objective_id"], prompt_pack._ACTIVE.get() is not None))
        raise gen.DecisionVetoError("Synthetic offline veto")
    monkeypatch.setattr(gen, "plan_decision", veto)
    monkeypatch.setattr(gen, "search_objective_docs", lambda *a, **k: pytest.fail("No docs call expected"))
    monkeypatch.setattr(gen, "database_client", lambda: pytest.fail("No database"))
    monkeypatch.setattr(gen.ObjectiveRotation, "select", lambda self, original, candidates: ("not-a-real-objective", 0))
    path = tmp_path / "batch.json"
    result = CliRunner().invoke(gen.main, ["--n-questions", "4", "--model", "codex", "--judge-model", "external",
        "--parallel", "1", "--argon-gate", "--artifact", str(path), "--prompt-pack", str(pack_file(tmp_path)),
        "--ab-interleaved", "--ab-experiment", "trial", "--continue-quality-rejections"])
    data = json.loads(path.read_text())
    assert len(data["candidates"]) == 4, result.output
    assert [entry["objective_id"] for entry in data["candidates"]] == [scope["objective_id"] for scope in data["plan"]]
    assert [packed for _, packed in seen] == [row["ab_assignment"]["arm"] == "challenger" for row in data["candidates"]]
    assert all(row["ab_assignment"] == scope["ab_assignment"] for row, scope in zip(data["candidates"], data["plan"]))
    assert data["ab_arm_report"]["control"]["candidates"] == 2
    assert data["ab_arm_report"]["challenger"]["candidates"] == 2


def test_batch_cli_routes_pack_only_to_generation_and_keeps_publish_gates(tmp_path):
    from scripts.run_domain_batch import batch_commands
    from scripts.pipeline_nightly import commands_for_batch
    pack = pack_file(tmp_path)
    _, _, commands = batch_commands("1.", "offline-test-ab", "machine-learning-engineer", 4, 2,
        prompt_pack=pack, ab_interleaved=True, ab_experiment="trial", ab_seed=3)
    generate, judge, ingest = commands
    assert "--prompt-pack" in generate and "--ab-interleaved" in generate
    assert "--full-gate-sample" in judge
    assert all("--prompt-pack" not in command and "--ab-interleaved" not in command for command in (judge, ingest))
    batch = {"cert": "machine-learning-engineer", "section": "1.", "count": 4}
    before = commands_for_batch(batch, "test", state_dir=tmp_path, tools=tmp_path)
    after = commands_for_batch(batch, "test", state_dir=tmp_path, tools=tmp_path,
        prompt_pack=pack, ab_interleaved=True, ab_experiment="trial", doccheck_policy="v6")
    assert "--doccheck-policy" in after[0][1] and "v6" in after[0][1]
    assert before[1] == after[1]
    assert "--prompt-pack" in after[0][1] and "--ab-interleaved" in after[0][1]


def test_full_pde_retry_ab_refuses_instead_of_bypassing_frozen_waves(tmp_path):
    from scripts.run_domain_batch import batch_commands
    with pytest.raises(ValueError, match="full-plan PDE"):
        batch_commands("all", "offline-ab", "data-engineer", 4, 1,
            prompt_pack=pack_file(tmp_path), ab_interleaved=True, ab_experiment="trial")


def test_arm_counts_are_visible_in_digest():
    from scripts.nightly_digest import digest
    rows = [{"ab_assignment": {"arm": arm}, "objective_id": "x", "accepted": arm == "challenger",
             "decision_proof": {"passed": True}} for arm in ("control", "challenger")]
    result = ab_arm_report(rows)
    assert result["control"]["accepted"] == 0 and result["challenger"]["accepted"] == 1
    text = digest({"generation_experiment": {"ab_experiment": "trial"}, "batches": [{"metrics": {"ab_arms": result}}]})
    assert "trial" in text and "challenger" in text and "control" in text


def row(arm, *, objective="x", pair="1", accepted=False, doc=True, council=True):
    return {"arm": arm, "cohort": "batch", "pair_id": pair, "objective_id": objective,
        "accepted": accepted, "doccheck_passed": doc, "council_passed": council,
        "complete": True, "seats": dict.fromkeys(SEATS, council),
        "guardrails": dict.fromkeys(GUARDRAILS, False)}


def test_paired_math_clusters_objectives_not_candidates():
    rows = [row("control", accepted=False), row("challenger", accepted=True),
            row("control", pair="2", accepted=False), row("challenger", pair="2", accepted=True),
            row("control", pair="3", objective="y", accepted=True), row("challenger", pair="3", objective="y", accepted=False)]
    stats = paired_statistics(rows)
    assert stats["paired_candidates"] == 3 and stats["objective_clusters"] == 2
    assert stats["objective_differences"] == {"x": 1, "y": -1}
    assert stats["difference"] == 0
    assert stats["clustered_standard_error"] == pytest.approx(1)
    assert stats["sequential"]["alpha_at_prefix"] == pytest.approx(.05 / 12)
    assert stats["sequential"]["radius"] == pytest.approx(math.sqrt(math.log(480)))
    assert not stats["sequential"]["yield_improved"]


def test_always_valid_spending_sums_to_alpha_and_repeated_looks_are_stable():
    assert sum(.05 / (n * (n + 1)) for n in range(1, 10000)) <= .05
    rows = []
    for n in range(1000):
        rows.extend([row("control", objective=str(n), pair=str(n)), row("challenger", objective=str(n), pair=str(n), accepted=True)])
    first = paired_statistics(rows)
    assert first == paired_statistics(rows)
    assert first["sequential"]["lower"] > 0
    assert first["sequential"]["yield_improved"]
    # Replicating candidates within ONE objective never invents independent clusters.
    for value in rows:
        value["objective_id"] = "x"
    assert not paired_statistics(rows)["sequential"]["yield_improved"]


def test_incomplete_duplicates_and_cross_objective_pairs_fail_closed():
    assert paired_statistics([row("control")])["incomplete_pairs"] == 1
    assert paired_statistics([])["sequential"]["lower"] is None
    with pytest.raises(ValueError, match="Duplicate"):
        paired_statistics([row("control"), row("control")])
    with pytest.raises(ValueError, match="crosses objectives"):
        paired_statistics([row("control"), row("challenger", objective="y")])
    with pytest.raises(ValueError, match="alpha"):
        paired_statistics([], alpha=0)


def test_conditional_council_and_guardrail_denominators_are_explicit():
    rows = [row("control", accepted=True), row("control", pair="2", council=False),
            row("control", pair="3", doc=False, council=False)]
    rows[1]["guardrails"]["generic_keys"] = True
    rows[2]["guardrails"]["generic_keys"] = None
    calls = [{"stage": "plan", "input_tokens": 100, "output_tokens": 10}]
    result = summarize(rows, calls)
    assert result["yield"] == pytest.approx(1 / 3)
    assert result["council_given_doccheck"] == .5
    assert result["guardrails"]["generic_keys"] == {"count": 1, "observed": 2, "rate": .5}
    assert result["complete"]
    assert not summarize(rows, [])["complete"]


def synthetic_artifact(tmp_path):
    plan = assignments()
    entries = []
    for index, scope in enumerate(plan, 1):
        entries.append({**scope, "index": index, "accepted": False, "failure_stage": "decision_veto",
                        "error_class": "DecisionVetoError", "decision_proof": {"passed": False}})
    path = tmp_path / "batch.json"
    path.write_text(json.dumps({"ab_experiment": {"id": "trial", "challenger_sha256": DIGEST, "seed": 0, "generation_only": True},
        "planned_count": len(plan), "plan": plan, "candidates": entries}))
    return path


def test_report_records_artifact_digests_and_blocks_missing_evidence(tmp_path):
    import hashlib
    path = synthetic_artifact(tmp_path)
    report = ab_report.make_report([path])
    assert report["artifact_sha256"][str(path)] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert report["paired"]["paired_candidates"] == 3
    assert not report["promotion"]["promote"]
    reasons = " ".join(report["promotion"]["reasons"])
    for text in ("token", "Canary", "schedule", "human", "held-out", "guardrail"):
        assert text.lower() in reasons.lower()
    output = tmp_path / "report.json"
    assert ab_report.main(["--artifact", str(path), "--output", str(output)]) == 0
    assert json.loads(output.read_text())["experiment"] == "trial"


def test_report_rejects_changed_assignment_and_duplicate_input(tmp_path):
    path = synthetic_artifact(tmp_path)
    with pytest.raises(ValueError, match="distinct"):
        ab_report.make_report([path, path])
    data = json.loads(path.read_text())
    data["candidates"][0]["ab_assignment"]["prompt_pack_sha256"] = "b" * 64
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="frozen A/B"):
        ab_report.make_report([path])


def test_rubric_echo_screen_reads_only_learner_fields_not_receipts():
    entry = {"stem": "Choose a deployment.", "options": [{"text": "Use managed serving"}],
             "rationales": {"A": "It meets the latency goal."}, "decision_proof": {"reason": "product_knowledge_hinge"}}
    assert not ab_report.ECHO.search(ab_report._learner_text(entry))
    entry["rationales"]["B"] = "This fails product_knowledge_hinge."
    assert ab_report.ECHO.search(ab_report._learner_text(entry))


def test_report_replays_frozen_gate_math_and_issue_text_screens(tmp_path, monkeypatch):
    import hashlib
    from shared import argon_gate, external_judge, gates
    from shared.quality_gate import QUESTION_FIELDS
    question = {field: field for field in QUESTION_FIELDS}
    monkeypatch.setattr(external_judge, "candidate_question", lambda entry: question)
    monkeypatch.setattr(argon_gate, "evaluate_argon", lambda *args: (False, "Recorded issues"))
    def gate(name):
        signature = gates.gate_signatures()[name]
        result = {key: True for key, field in signature.output_fields.items() if field.annotation is bool}
        result.update(verdict="PASS", score=.95, reason="Recorded pass")
        if name == "style":
            result["generic_validation_key"] = False
        return result
    choice = next(label for label, origin in gates.blind_choice_map(question).items() if origin == "A")
    blind = {"verdict": "PASS", "choice": choice, "confidence": .95,
             "ambiguous_answers": False, "reason": "Recorded pass"}
    raw = {"blind_solver": blind, "style": gate("style"), "evidence": gate("evidence"),
           "argon": {"blind": blind, "review": {"verdict": "REVISE", "key_correct": True,
              "other_defensible_option": False, "issues": ["Literal elimination from stem text alone", "Unsupported evidence gap"]}}}
    requestpath = tmp_path / "request.json"
    requestpath.write_text(json.dumps({"candidate_id": "candidate", "objective_id": "x", "argon": {"version": 3}}))
    entry = {"candidate_id": "candidate", "objective_id": "x", "ab_assignment": assignments()[0]["ab_assignment"],
             "stem": "Choose managed serving", "options": [{"text": "Deploy a model"}], "rationales": {},
             "decision_proof": {"passed": True}, "decision_plan": {"engineering_decision": "Choose serving"},
             "external_verdict": raw, "external_judge_request": {"path": "request.json",
             "sha256": hashlib.sha256(requestpath.read_bytes()).hexdigest()}}
    row = ab_report.candidate_row({"rules_version": 5}, entry, tmp_path / "batch.json")
    assert row["complete"] and not row["council_passed"]
    assert set(row["seats"]) == set(SEATS)
    assert row["guardrails"]["argon_literal_elimination"] is True
    assert row["guardrails"]["argon_evidence_gap"] is True
    assert row["guardrails"]["generic_keys"] is False
    assert row["guardrails"]["rubric_echoes"] is False
    original_style = entry["external_verdict"]["style"]
    entry["external_verdict"]["style"] = {"status": "skipped"}
    assert not ab_report.candidate_row({"rules_version": 5}, entry, tmp_path / "batch.json")["complete"]
    entry["external_verdict"]["style"] = original_style
    requestpath.write_text("{}")
    assert not ab_report.candidate_row({"rules_version": 5}, entry, tmp_path / "batch.json")["complete"]


def test_report_reuses_promotion_then_enforces_all_extra_guardrails(tmp_path, monkeypatch):
    path = synthetic_artifact(tmp_path)
    data = json.loads(path.read_text())
    calls = [{"stage": "plan", "index": entry["index"], "input_tokens": 100, "output_tokens": 10}
             for entry in data["candidates"]]
    Path(str(path) + ".calls.jsonl").write_text("\n".join(json.dumps(call) for call in calls))
    def normalized(payload, entry, artifact):
        passed = entry["ab_assignment"]["arm"] == "challenger" or entry["index"] > 2
        result = row(entry["ab_assignment"]["arm"], accepted=passed, council=passed)
        result.update(entry["ab_assignment"], objective_id=entry["objective_id"], mechanism=str(entry["index"]))
        return result
    monkeypatch.setattr(ab_report, "candidate_row", normalized)
    original_stats = ab_report.paired_statistics
    def positive_sequential(rows, **kwargs):
        result = original_stats(rows, **kwargs)
        result["sequential"].update(lower=.1, yield_improved=True)
        return result
    monkeypatch.setattr(ab_report, "paired_statistics", positive_sequential)
    canary = {"kind": "canaries", "complete": True, "errors": [], "observed": 40,
        "canaries": {name: {"count": 20, "catch_rate": 1, "full": True} for name in ("swapped_key", "retired_name")}}
    binding = {"experiment": "trial", "challenger_sha256": DIGEST, "complete": True}
    spot = {**binding, "pairs": 10, "losses": 1, "factual_defects": 0}
    held = {**binding, "count": 30, "gain_persists": True}
    schedule = {**binding, "artifacts": [str(path)], "independent_objectives_no_interference": True}
    report = ab_report.make_report([path], canary=canary, spot_check=spot, held_out=held, schedule=schedule)
    assert report["promotion"]["promote"], report["promotion"]["reasons"]
    for kwargs, fragment in [({"spot_check": {**spot, "losses": 7}}, "human"),
                             ({"spot_check": {**spot, "factual_defects": 1}}, "human"),
                             ({"held_out": {**held, "gain_persists": False}}, "held-out"),
                             ({"schedule": {**schedule, "artifacts": ["other.json", str(path)]}}, "schedule")]:
        inputs = {"canary": canary, "spot_check": spot, "held_out": held, "schedule": schedule, **kwargs}
        result = ab_report.make_report([path], **inputs)
        assert not result["promotion"]["promote"]
        assert fragment in " ".join(result["promotion"]["reasons"])
    def bad_guardrail(payload, entry, artifact):
        result = normalized(payload, entry, artifact)
        if result["arm"] == "challenger":
            result["guardrails"]["generic_keys"] = True
        return result
    monkeypatch.setattr(ab_report, "candidate_row", bad_guardrail)
    result = ab_report.make_report([path], canary=canary, spot_check=spot, held_out=held, schedule=schedule)
    assert not result["promotion"]["promote"]
    assert any("generic_keys" in reason for reason in result["promotion"]["reasons"])


def test_repeated_objective_slots_preserve_each_randomized_arm_pair():
    plan = assignments()
    x = [scope for scope in plan if scope["objective_id"] == "x"]
    assert len(x) == 4
    assert [scope["ab_assignment"]["objective_pair"] for scope in x] == [0, 0, 1, 1]
    for ordinal in (0, 1):
        pair = [scope["ab_assignment"] for scope in x if scope["ab_assignment"]["objective_pair"] == ordinal]
        assert {item["arm"] for item in pair} == {"control", "challenger"}
        assert pair[0]["pair_id"] == pair[1]["pair_id"]
        assert pair[0]["prompt_pack_sha256"] != pair[1]["prompt_pack_sha256"]


@pytest.mark.parametrize("mutation", ["swap-index", "duplicate-index", "out-of-range", "bool-index", "both-control", "bad-pair", "changed-plan-objective", "truncated-plan"])
def test_report_recomputes_frozen_pair_assignments_and_index_scope_bijection(tmp_path, mutation):
    path = synthetic_artifact(tmp_path)
    data = json.loads(path.read_text())
    if mutation == "swap-index":
        data["candidates"][0]["index"], data["candidates"][2]["index"] = 3, 1
    elif mutation == "duplicate-index":
        data["candidates"][1]["index"] = 1
    elif mutation == "out-of-range":
        data["candidates"][0]["index"] = 100
    elif mutation == "bool-index":
        data["candidates"][0]["index"] = True
    elif mutation == "both-control":
        for scope, entry in zip(data["plan"], data["candidates"]):
            scope["ab_assignment"]["arm"] = entry["ab_assignment"]["arm"] = "control"
            scope["ab_assignment"]["prompt_pack_sha256"] = entry["ab_assignment"]["prompt_pack_sha256"] = None
    elif mutation == "bad-pair":
        data["plan"][0]["ab_assignment"]["pair_id"] = data["candidates"][0]["ab_assignment"]["pair_id"] = "forged"
    elif mutation == "changed-plan-objective":
        data["plan"][1]["objective_id"] = data["candidates"][1]["objective_id"] = "y"
    elif mutation == "truncated-plan":
        data["plan"].pop()
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError):
        ab_report.make_report([path])


def test_report_allows_runtime_proofs_in_plan_without_changing_assignments(tmp_path):
    path = synthetic_artifact(tmp_path)
    data = json.loads(path.read_text())
    data["plan"][0]["decision_plan"] = {"engineering_decision": "Runtime decision"}
    data["plan"][1]["decision_proof"] = {"passed": True}
    path.write_text(json.dumps(data))
    assert not ab_report.make_report([path])["promotion"]["promote"]
