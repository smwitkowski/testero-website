"""Offline contract replays, not a live semantic-quality evaluation."""
from copy import deepcopy
import json

from click.testing import CliRunner
import pytest
from pydantic import ValidationError

from scripts import generate_pmle_questions as generate
from scripts.run_domain_batch import batch_commands
from shared.decision_planner import (
    ConstraintDecisionProofSignature, DecisionProofSignature, planning_prompt,
    verification_prompt, verify_decision,
)
from test_decision_first_v4 import decision, proof, scope, pipeline
from test_external_generation import source


def v6_scope():
    return {**scope(), "doccheck_policy": "v6"}


def test_v6_constraint_prompt_and_rubric_keep_all_rejections():
    signature, inputs = planning_prompt(v6_scope())
    assert "documented POSITIVE fact" in signature.instructions
    assert "stated scenario constraint" in signature.instructions
    assert "X is slower than Y" in signature.instructions
    signature, _ = verification_prompt(v6_scope(), decision(), [source()])
    assert signature is ConstraintDecisionProofSignature
    for text in ("unsupported positive claims", "wrong facts", "outdated names",
                 "second defensible answer", "Silence is", "Never add constraints",
                 "independent council/evidence review is unchanged"):
        assert text in signature.instructions
    assert "failing_options" in signature.output_fields


@pytest.mark.parametrize("failure", [None, "negative_claim", "second_answer", "unsupported_positive", "wrong_fact", "outdated_name"])
def test_canned_constraint_rubric_receipts_do_not_override_semantic_veto(failure):
    # The canned critic represents the rubric outcome. This does NOT test a live model.
    plan = decision()
    plan["decisive_constraints"] = ["Keep infrastructure management low"]
    plan["mistakes"][2]["scenario_reason"] = (
        "Compute Engine provides virtual machines; the team wants managed application infrastructure")
    value = {**proof(), "failing_options": []}
    if failure:
        value.update(supported=False, reason=failure,
                     failing_options=["A"] if failure == "second_answer" else ["D"])
        if failure == "second_answer":
            value["uniquely_best"] = False
    checked = verify_decision(v6_scope(), plan, [source()], model="codex", predictor=lambda **kw: value)
    assert checked["passed"] is (failure is None)
    assert checked["mechanical_check"]["passed"] is True


@pytest.mark.parametrize("stable", [False, True])
def test_explicit_v5_prompts_are_identical_to_absent_policy(stable):
    base = scope()
    explicit = {**base, "doccheck_policy": "v5"}
    for build, args in ((planning_prompt, ()), (verification_prompt, (decision(), [source()]))):
        a, ai = build(base, *args, stable_prefix=stable)
        b, bi = build(explicit, *args, stable_prefix=stable)
        assert ai == bi
        assert a.instructions == b.instructions
        assert list(a.fields) == list(b.fields)
        assert a.model_json_schema() == b.model_json_schema()
    assert verification_prompt(base, decision(), [source()])[0] is DecisionProofSignature


def test_default_v5_plan_bytes_and_explicit_v6_metadata(tmp_path, monkeypatch):
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    runner = CliRunner()
    paths = [tmp_path / name for name in ("default.json", "v5.json", "v6.json")]
    for path, extra in zip(paths, ([], ["--doccheck-policy", "v5"], ["--doccheck-policy", "v6"])):
        result = runner.invoke(generate.main, ["--plan-only", "--n-questions", "2", "--seed", "2510",
            "--artifact", str(path), *extra])
        assert result.exit_code == 0, result.output
    assert paths[0].read_bytes() == paths[1].read_bytes()
    saved = json.loads(paths[2].read_text())
    assert saved["doccheck_policy"] == "v6"
    assert all(row["doccheck_policy"] == "v6" for row in saved["plan"])


def test_runner_threads_only_v6_and_invalid_policy_fails():
    _, _, default = batch_commands("all", "doccheck-offline-default", "machine-learning-engineer", 40, 2, plan_only=True)
    _, _, explicit = batch_commands("all", "doccheck-offline-default", "machine-learning-engineer", 40, 2, plan_only=True, doccheck_policy="v5")
    assert default == explicit
    _, _, commands = batch_commands("all", "doccheck-offline-v6", "machine-learning-engineer", 40, 2, plan_only=True, doccheck_policy="v6")
    assert commands[0][-3:] == ["--doccheck-policy", "v6", "--plan-only"]
    with pytest.raises(ValueError, match="policy"):
        planning_prompt({**scope(), "doccheck_policy": "unknown"})


def test_v6_candidate_provenance_can_rebuild_registry_scope(pipeline):
    from scripts.ingest_external_verdicts import _scope
    _, path, invoke = pipeline
    result = invoke("--doccheck-policy", "v6")
    assert result.exit_code == 0, result.output
    payload = json.loads((path / "batch.json").read_text())
    entry = payload["candidates"][0]
    assert _scope(payload, entry)["doccheck_policy"] == "v6"
    with pytest.raises(ValueError, match="doccheck"):
        _scope(payload, {**entry, "doccheck_policy": "v5"})


def test_v5_prompt_fingerprints_match_frozen_main():
    import hashlib
    from pathlib import Path
    from shared.cert_context import plan_questions
    frozen = json.loads((Path(__file__).parent / "fixtures/doccheck/v5-prompt-fingerprints.json").read_text())
    assert frozen["source_commit"] == "5c9814c"
    for row in frozen["cases"]:
        selected = plan_questions(row["cert"], 1, seed=2510)[0]
        selected["distractor_evidence"] = {"version": 1, "mode": row["mode"]}
        signature, inputs = (planning_prompt(selected, stable_prefix=row["stable"]) if row["kind"] == "plan" else
            verification_prompt(selected, decision(), [source()], stable_prefix=row["stable"]))
        payload = {"instructions": signature.instructions, "inputs": inputs,
                   "schema": signature.model_json_schema(), "fields": list(signature.fields)}
        actual = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        assert actual == row["sha256"], row


def test_v6_explicit_failing_options_cannot_be_a_pass():
    value = {**proof(), "failing_options": ["D"]}
    checked = verify_decision(v6_scope(), decision(), [source()], model="offline", predictor=lambda **_: value)
    assert checked["mechanical_check"]["passed"] is True
    assert checked["passed"] is False
