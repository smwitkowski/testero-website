"""Held-out report math and production orchestration, without model calls."""
from copy import deepcopy
import json
from types import SimpleNamespace

import pytest

from scripts.optimize.evaluate_pack import (
    SEATS, ProductionRunner, canary_commands, evaluate_pack, load_heldout_records, main,
    promotion_decision, summarize_arm, writer_token_usage,
)


def candidate(objective="x", *, passed=True, proofs=(False, True)):
    return {"objective_id": objective, "proof_attempts": list(proofs), "doccheck_passed": True,
            "eligible": True, "council_attempted": True, "seats": dict.fromkeys(SEATS, passed)}


def usage(tokens=1000):
    return {"writer_tokens": tokens, "known_writer_tokens": tokens, "writer_calls": 3, "complete": True}


def arm(rows, tokens=1000):
    return {"candidates": rows, "writer_usage": usage(tokens), "complete": True}


def canaries():
    return {"kind": "canaries", "complete": True, "errors": [], "observed": 40,
            "canaries": {name: {"count": 20, "catch_rate": 1, "full": True} for name in ("swapped_key", "retired_name")}}


def test_report_math_uses_actual_writer_tokens_and_explicit_denominators():
    rows = [candidate(passed=True), candidate("y", passed=False, proofs=(True,))]
    summary = summarize_arm(arm(rows, 2000))
    assert summary["doccheck_pass_rate"] == pytest.approx(2 / 3)
    assert summary["doccheck_candidate_pass_rate"] == 1
    assert summary["council_pass_rate"] == .5
    assert summary["accepted"] == 1
    assert summary["accepted_per_million_writer_tokens"] == 500
    assert all(rate == .5 for rate in summary["seat_pass_rates"].values())


def test_full_council_missing_or_skipped_seat_is_never_a_pass():
    row = candidate()
    row["seats"].pop("argon.blind")
    with pytest.raises(ValueError, match="every production seat"):
        summarize_arm(arm([row]))
    row = candidate()
    row["seats"]["argon.review"] = {"status": "skipped"}
    with pytest.raises(ValueError):
        summarize_arm(arm([row]))


def test_unknown_or_zero_tokens_do_not_invent_yield():
    for tokens in (None, 0):
        result = arm([candidate()], tokens)
        result["writer_usage"]["complete"] = tokens is not None
        assert summarize_arm(result)["accepted_per_million_writer_tokens"] is None
    with pytest.raises(ValueError):
        summarize_arm(arm([candidate()], True))


def test_usage_counts_proof_and_failed_attempts_not_council_or_estimates():
    calls = [{"stage": stage, "input_tokens": 100, "output_tokens": 10, "ok": stage != "plan"}
             for stage in ("plan", "verify", "write", "cite", "judge_style", "argon_review")]
    result = writer_token_usage(calls)
    assert result["writer_tokens"] == 440
    assert result["writer_calls"] == 4
    calls[1]["output_tokens"] = None
    assert writer_token_usage(calls)["writer_tokens"] is None
    assert not writer_token_usage([])["complete"]


def test_claude_cache_totals_are_added_once():
    result = writer_token_usage([{"stage": "plan", "provider": "claude", "input_tokens": 10, "output_tokens": 5,
                                 "cached_input_tokens": 100, "cache_creation_input_tokens": 20}])
    assert result["writer_tokens"] == 135


def test_promotion_strict_improvement_5pp_boundary_and_full_canary():
    baseline = summarize_arm(arm([candidate(), candidate("y", passed=False)]))
    packed = deepcopy(baseline)
    packed["council_pass_rate"] = .6
    packed["seat_pass_rates"]["claude.style"] = .45
    assert promotion_decision(baseline, packed, canaries())["promote"]
    packed["seat_pass_rates"]["claude.style"] = .449
    assert not promotion_decision(baseline, packed, canaries())["promote"]
    packed["seat_pass_rates"]["claude.style"] = .5
    for canary in (None, {"catch_rate": 1}, canaries() | {"complete": False}):
        assert not promotion_decision(baseline, packed, canary)["promote"]
    assert not promotion_decision(baseline, baseline, canaries())["promote"]


def test_no_council_candidates_or_partial_telemetry_blocks_promotion():
    row = candidate()
    row.update(council_attempted=False, seats={})
    base = summarize_arm(arm([row]))
    assert base["council_pass_rate"] is None
    assert not promotion_decision(base, base, canaries())["promote"]
    base = summarize_arm(arm([candidate()]))
    improved = deepcopy(base)
    base["council_pass_rate"] = .5
    improved["complete"] = False
    assert not promotion_decision(base, improved, canaries())["promote"]


def pack_file(tmp_path, policy=None):
    from shared.prompt_pack import create_pack, save_pack
    path = tmp_path / "pack.json"
    save_pack(create_pack(stage="plan", policy=policy or {}, source_run="offline-test", scores={}), path)
    return path


def records():
    return [{"objective_id": "x", "scope": {"objective_id": "x", "cert_id": "fake", "decision_plan": {"secret": "test plan"}},
             "sources": [{"text": "Frozen documentation"}], "outputs": {"stem": "held-out question MUST NOT BECOME A DEMO"}}]


def test_paired_evaluator_same_seed_model_sources_and_no_test_question_leak(tmp_path):
    seen = []
    def runner(rows, **kwargs):
        seen.append((deepcopy(rows), kwargs))
        assert "outputs" not in rows[0]
        assert "decision_plan" not in rows[0]["scope"]
        return arm([candidate("x", passed=kwargs["prompt_pack"] is not None)])
    pack = pack_file(tmp_path)
    out = tmp_path / "eval"
    report = evaluate_pack(records(), pack_path=pack, model="codex", seed=45, output_dir=out,
                           runner=runner, canary=canaries())
    assert report["promotion"]["promote"]
    assert seen[0][0] == seen[1][0]
    assert seen[0][1]["seed"] == seen[1][1]["seed"] == 45
    assert seen[0][1]["model"] == seen[1][1]["model"] == "codex"
    assert seen[0][1]["prompt_pack"] is None
    assert seen[1][1]["prompt_pack"] == pack.absolute()
    assert report["full_gate_sample"] == 1
    assert len(report["council_seats"]) == 5
    assert json.loads((out / "report.json").read_text())["promotion"]["promote"]
    text = (out / "report.md").read_text()
    assert "five downstream" in text and "100%" in text
    assert "--state" in text and "--pause" in text
    with pytest.raises(FileExistsError):
        evaluate_pack(records(), pack_path=pack, model="codex", seed=45, output_dir=out, runner=runner)


def test_direct_api_rejects_mixed_or_nonmatching_certifications(tmp_path):
    def runner(*args, **kwargs):
        pytest.fail("Certification mismatch must stop before generation")
    pack = pack_file(tmp_path, {"cert_id": "fake"})
    mixed = records() + [{"objective_id": "y", "scope": {"objective_id": "y", "cert_id": "other"}, "sources": [{"text": "docs"}]}]
    with pytest.raises(ValueError, match="exactly one certification"):
        evaluate_pack(mixed, pack_path=pack, model="codex", seed=45, output_dir=tmp_path / "mixed", runner=runner)
    pack = pack_file(tmp_path, {"cert_id": "other"})
    with pytest.raises(ValueError, match="certification differs"):
        evaluate_pack(records(), pack_path=pack, model="codex", seed=45, output_dir=tmp_path / "mismatch", runner=runner)


def test_cli_filters_validated_heldout_records_to_declared_pack_cert(tmp_path, monkeypatch):
    from scripts.optimize import evaluate_pack as module, budget
    pack = pack_file(tmp_path, {"cert_id": "fake"})
    prices = tmp_path / "prices.json"
    prices.write_text("{}")
    mixed = records() + [{"objective_id": "y", "scope": {"objective_id": "y", "cert_id": "other"}, "sources": [{"text": "docs"}]}]
    seen = {}
    def heldout(path):
        seen["validated"] = path
        return mixed, "a" * 64
    def fake_evaluate(rows, **kwargs):
        assert "validated" in seen
        seen["records"] = rows
        seen["manifest"] = kwargs["manifest_sha256"]
        return {"promotion": {"promote": False}}
    monkeypatch.setattr(module, "load_heldout_records", heldout)
    monkeypatch.setattr(module, "evaluate_pack", fake_evaluate)
    monkeypatch.setattr(budget, "SpendBudget", lambda *args: object())
    assert main(["--datasets", str(tmp_path), "--prompt-pack", str(pack), "--out", str(tmp_path / "eval"),
                 "--prices", str(prices), "--budget-usd", "1", "--coordinator-approved"]) == 0
    assert seen["records"] == records()
    assert seen["manifest"] == "a" * 64


def test_pack_training_and_manifest_provenance_checked_before_any_runner(tmp_path):
    def runner(*args, **kwargs):
        pytest.fail("Pack leakage must be rejected before generation")
    pack = pack_file(tmp_path, {"training_objectives": ["x"]})
    with pytest.raises(ValueError, match="trained on held-out"):
        evaluate_pack(records(), pack_path=pack, model="codex", seed=45, output_dir=tmp_path / "leak", runner=runner)
    pack = pack_file(tmp_path, {"dataset_manifest_sha256": "a" * 64, "training_objectives": ["train-only"]})
    with pytest.raises(ValueError, match="manifest hash"):
        evaluate_pack(records(), pack_path=pack, model="codex", seed=45, output_dir=tmp_path / "mismatch", runner=runner,
                      manifest_sha256="b" * 64)


def test_pack_provenance_matching_manifest_and_disjoint_training(tmp_path):
    pack = pack_file(tmp_path, {"dataset_manifest_sha256": "a" * 64, "training_objectives": ["train-only"]})
    report = evaluate_pack(records(), pack_path=pack, model="codex", seed=45, output_dir=tmp_path / "eval",
                           runner=lambda rows, **kw: arm([candidate()]), manifest_sha256="a" * 64)
    assert report["dataset_manifest_sha256"] == "a" * 64


def test_changed_pack_is_not_reported_as_a_valid_pair(tmp_path):
    pack = pack_file(tmp_path)
    def runner(rows, **kwargs):
        if kwargs["prompt_pack"] is not None:
            pack.write_text('{"changed": true}')
        return arm([candidate()])
    with pytest.raises(ValueError, match="pack changed"):
        evaluate_pack(records(), pack_path=pack, model="codex", seed=45, output_dir=tmp_path / "eval", runner=runner)


def test_live_runner_requires_hard_budget(tmp_path):
    with pytest.raises(ValueError, match="hard local model budget"):
        evaluate_pack(records(), pack_path=tmp_path / "pack", model="codex", seed=45, output_dir=tmp_path / "eval")


def test_pairs_must_cover_exact_objectives(tmp_path):
    def runner(rows, **kwargs):
        return arm([candidate("other")])
    with pytest.raises(ValueError, match="same held-out objectives"):
        evaluate_pack(records(), pack_path=pack_file(tmp_path), model="codex", seed=45,
                      output_dir=tmp_path / "eval", runner=runner)


def test_eligible_objective_subset_preserves_universal_holdout_and_hashes(tmp_path):
    import hashlib
    raw = json.dumps(records()).encode()
    (tmp_path / "plan.test.json").write_bytes(raw)
    manifest = {"splits": {"train": ["train-only"], "dev": ["dev-only"], "test": ["x", "excluded-test"]},
                "eligible_splits": {"plan": {"test": ["x"]}},
                "files": {"plan.test.json": hashlib.sha256(raw).hexdigest()}}
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest))
    rows, digest = load_heldout_records(tmp_path)
    assert rows == records()
    assert digest == hashlib.sha256(path.read_bytes()).hexdigest()
    (tmp_path / "plan.test.json").write_text("[]")
    with pytest.raises(ValueError, match="file does not match"):
        load_heldout_records(tmp_path)
    (tmp_path / "plan.test.json").write_bytes(raw)
    manifest["splits"]["train"].append("excluded-test")
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="Universal dataset objective splits overlap"):
        load_heldout_records(tmp_path)


def test_cli_requires_approval_before_any_reads_or_calls(tmp_path):
    with pytest.raises(SystemExit) as exc:
        main(["--datasets", str(tmp_path / "no-datasets"), "--prompt-pack", str(tmp_path / "no-pack"),
              "--out", str(tmp_path / "out"), "--prices", str(tmp_path / "no-prices"), "--budget-usd", "1"])
    assert exc.value.code == 2
    assert not (tmp_path / "out").exists()


def test_production_runner_calls_real_seams_with_safe_flags_and_all_seats(tmp_path, monkeypatch):
    from scripts import generate_pmle_questions as generator, judge_requests
    from shared import external_judge, gates, argon_gate
    from shared.quality_gate import QUESTION_FIELDS
    question = {field: field for field in QUESTION_FIELDS}
    seen = {}
    def fake_main(*, args, standalone_mode):
        seen["args"] = args
        assert standalone_mode is False
        # The production retrieval seam returns frozen docs, without web calls.
        assert generator.search_objective_docs("objective", [], objective_id="x") == records()[0]["sources"]
        artifact = __import__("pathlib").Path(args[args.index("--artifact") + 1])
        reqs = external_judge.request_directory(artifact)
        reqs.mkdir()
        request = {"gate_version": 5, "argon": {"version": 3}}
        (reqs / "candidate.json").write_text(json.dumps(request))
        entry = {"candidate_id": "candidate", "objective_id": "x", "decision_attempts": [{"proof": {"passed": True}}],
                 "decision_proof": {"passed": True}, "schema_check": {"passed": True}, "mechanical_check": {"passed": True},
                 "external_judge_request": {"path": str((reqs / "candidate.json").relative_to(artifact.parent))}}
        artifact.write_text(json.dumps({"candidates": [entry]}))
        __import__("pathlib").Path(str(artifact) + ".calls.jsonl").write_text(json.dumps({"stage": "write", "input_tokens": 100, "output_tokens": 50}) + "\n")
    def fake_judges(requests, verdicts, **kwargs):
        seen["judges"] = kwargs
        verdicts.mkdir()
        def gate(name):
            signature = gates.gate_signatures()[name]
            return {**{key: True for key, field in signature.output_fields.items() if field.annotation is bool},
                    "verdict": "PASS", "score": .95, "reason": "Recorded pass"}
        choice = next(label for label, origin in gates.blind_choice_map(question).items() if origin == "A")
        blind = {"verdict": "PASS", "choice": choice, "confidence": .95, "ambiguous_answers": False, "reason": "Recorded pass"}
        raw = {"blind_solver": blind, "style": gate("style"), "evidence": gate("evidence"),
               "argon": {"blind": blind, "review": {"verdict": "PASS", "key_correct": True, "other_defensible_option": False, "issues": []}}}
        (verdicts / "candidate.json").write_text(json.dumps(raw))
        return SimpleNamespace(failed=0, remaining=0, usage_stopped=False, persistence_failed=False)
    monkeypatch.setattr(generator.main, "main", fake_main)
    monkeypatch.setattr(judge_requests, "run_requests", fake_judges)
    monkeypatch.setattr(external_judge, "candidate_question", lambda entry: question)
    monkeypatch.setattr(argon_gate, "evaluate_argon", lambda *args: (True, "Recorded full council pass"))
    result = ProductionRunner()(records(), model="codex", seed=45, prompt_pack=tmp_path / "pack.json",
                                output_dir=tmp_path / "arm", doccheck_policy="v6")
    assert result["complete"]
    assert result["writer_usage"]["writer_tokens"] == 150
    assert all(result["candidates"][0]["seats"].values())
    assert seen["judges"] == {"judge_model": "claude", "parallel": 1, "argon_gate": True, "full_gate_sample": 1}
    for flag in ("--dry-run", "--argon-gate", "--prompt-pack"):
        assert flag in seen["args"]
    assert seen["args"][seen["args"].index("--judge-model") + 1] == "external"
