"""Explicit frozen A vs A+card control packs; unconfigured A/B stays identical."""
from copy import deepcopy
import json
import sys

from click.testing import CliRunner
import pytest

from scripts import generate_pmle_questions as gen
from scripts import pipeline_nightly as nightly
from scripts import run_domain_batch as batch
from shared import prompt_pack
from shared.ab_experiment import generation_call, interleave_plan
from shared.decision_planner import DecisionPlanSignature


OBJECTIVE = "machine-learning-engineer:standard:3.3:2"
LESSON = "Coverage: The supplied pages do not describe gradient accumulation. Lifecycle: No dated lifecycle changes. Names: Agent Platform."


def packs(tmp_path, policy=None):
    common = dict(stage="plan", signature=DecisionPlanSignature, policy=policy or {}, scores={})
    control = prompt_pack.create_pack(**common, source_run="frozen-A", instructions="Original A decision guidance.")
    challenger = deepcopy(control)
    challenger["source_run"] = "frozen-A-plus-card"
    challenger["writers"][0]["lessons"] = {OBJECTIVE: LESSON}
    paths = (tmp_path / "control.json", tmp_path / "challenger.json")
    for pack, path in zip((control, challenger), paths):
        prompt_pack.save_pack(pack, path)
    return paths, (control, challenger)


def test_explicit_control_assignment_preserves_randomization_and_default_shape():
    scopes = [{"objective_id": "x"}, {"objective_id": "y"}]
    common = dict(experiment="test", seed=3, pack_sha256="b" * 64)
    legacy = interleave_plan(scopes, **common)
    assert legacy == interleave_plan(scopes, **common, control_pack_sha256=None)
    assert all("control_sha256" not in row["ab_assignment"] for row in legacy)
    explicit = interleave_plan(scopes, **common, control_pack_sha256="a" * 64)
    for old, new in zip(legacy, explicit):
        assignment = deepcopy(new["ab_assignment"])
        assert assignment.pop("control_sha256") == "a" * 64
        if assignment["arm"] == "control":
            assert assignment["prompt_pack_sha256"] == "a" * 64
            assignment["prompt_pack_sha256"] = None
        assert assignment == old["ab_assignment"]
    with pytest.raises(ValueError, match="control pack"):
        interleave_plan(scopes, **common, control_pack_sha256="invalid")


def test_explicit_A_and_A_plus_card_activate_only_their_writer_contexts(tmp_path, monkeypatch):
    (control_path, challenger_path), (control, challenger) = packs(tmp_path)
    monkeypatch.setattr(gen, "ARTIFACT_ROOT", tmp_path)
    seen = []
    def planner(scope, **kwargs):
        active = prompt_pack._ACTIVE.get()
        seen.append((scope["ab_assignment"]["arm"], prompt_pack.pack_hash(active),
                     prompt_pack.writer_plan_additions(scope)))
        # Proof/retrieval/judges clear even an explicitly packed control.
        assert generation_call(lambda: prompt_pack._ACTIVE.get(), prompt_pack=active) is None
        raise gen.DecisionVetoError("Synthetic offline veto")
    monkeypatch.setattr(gen, "plan_decision", planner)
    monkeypatch.setattr(gen, "search_objective_docs", lambda *a, **k: pytest.fail("No docs"))
    monkeypatch.setattr(gen, "database_client", lambda: pytest.fail("No DB"))
    artifact = tmp_path / "batch.json"
    result = CliRunner().invoke(gen.main, ["--n-questions", "2", "--objective", OBJECTIVE,
        "--model", "codex", "--judge-model", "external", "--argon-gate", "--parallel", "1",
        "--continue-quality-rejections", "--artifact", str(artifact), "--prompt-pack", str(challenger_path),
        "--ab-control-pack", str(control_path), "--ab-interleaved", "--ab-experiment", "A-card"])
    # A planner exception is a system-stage stop, not a returned doc-quality veto.
    assert result.exit_code == 1, result.output
    assert len(seen) == 2
    expected = {"control": prompt_pack.pack_hash(control), "challenger": prompt_pack.pack_hash(challenger)}
    for arm, digest, additions in seen:
        assert digest == expected[arm]
        assert (LESSON in additions) is (arm == "challenger")
    data = json.loads(artifact.read_text())
    assert data["ab_control_pack"] == {"sha256": expected["control"], "stage": "plan",
                                        "source_run": "frozen-A", "policy": {}}
    assert data["ab_experiment"]["control_sha256"] == expected["control"]
    for entry in data["candidates"]:
        assignment = entry["ab_assignment"]
        assert assignment["control_sha256"] == expected["control"]
        assert assignment["prompt_pack_sha256"] == expected[assignment["arm"]]


def test_plain_control_artifact_adds_no_control_metadata(tmp_path, monkeypatch):
    (_, challenger_path), _ = packs(tmp_path)
    monkeypatch.setattr(gen, "ARTIFACT_ROOT", tmp_path)
    artifact = tmp_path / "batch.json"
    result = CliRunner().invoke(gen.main, ["--n-questions", "2", "--model", "codex", "--judge-model", "external",
        "--argon-gate", "--plan-only", "--artifact", str(artifact), "--prompt-pack", str(challenger_path),
        "--ab-interleaved", "--ab-experiment", "plain-card"])
    assert result.exit_code == 0, result.output
    data = json.loads(artifact.read_text())
    assert "ab_control_pack" not in data and "control_sha256" not in data["ab_experiment"]
    for row in data["plan"]:
        assert "control_sha256" not in row["ab_assignment"]
        if row["ab_assignment"]["arm"] == "control":
            assert row["ab_assignment"]["prompt_pack_sha256"] is None


@pytest.mark.parametrize("policy", [{"cert_id": "data-engineer"}, {"doccheck_policy": "v6"}, {"distractor_evidence": "consistent"}])
def test_control_policy_must_match_generator_before_calls(tmp_path, monkeypatch, policy):
    (control_path, _), _ = packs(tmp_path, policy)
    challenger = prompt_pack.create_pack(stage="plan", policy={}, scores={}, source_run="challenger")
    challenger_path = tmp_path / "valid-challenger.json"
    prompt_pack.save_pack(challenger, challenger_path)
    monkeypatch.setattr(gen, "plan_questions", lambda *a, **k: pytest.fail("Invalid policy before planning"))
    artifact = tmp_path / "batch.json"
    result = CliRunner().invoke(gen.main, ["--n-questions", "2", "--model", "codex", "--judge-model", "external",
        "--argon-gate", "--plan-only", "--artifact", str(artifact), "--prompt-pack", str(challenger_path),
        "--ab-control-pack", str(control_path), "--ab-interleaved", "--ab-experiment", "bad-policy"])
    assert result.exit_code == 1 and "Control prompt pack policy differs" in result.output
    assert not artifact.exists()


def test_control_flag_requires_interleaved_everywhere(tmp_path):
    (control_path, _), _ = packs(tmp_path)
    result = CliRunner().invoke(gen.main, ["--plan-only", "--ab-control-pack", str(control_path)])
    assert result.exit_code == 1 and "requires --ab-interleaved" in result.output
    with pytest.raises(ValueError, match="requires --ab-interleaved"):
        batch.batch_commands("1.", "bad-control", "machine-learning-engineer", 2, 1, ab_control_pack=control_path)
    with pytest.raises(ValueError, match="requires --ab-interleaved"):
        nightly.commands_for_batch({"cert": "machine-learning-engineer", "section": "1.", "count": 2},
            "bad", state_dir=tmp_path, tools=tmp_path, ab_control_pack=control_path)


def test_explicit_control_is_generation_only_in_batch_and_nightly(tmp_path, monkeypatch):
    (control_path, challenger_path), _ = packs(tmp_path)
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    options = dict(prompt_pack=challenger_path, ab_control_pack=control_path, ab_interleaved=True, ab_experiment="card")
    _, _, commands = batch.batch_commands("1.", "A-card", "machine-learning-engineer", 2, 1, **options)
    assert commands[0][commands[0].index("--ab-control-pack") + 1] == str(control_path)
    assert all("--ab-control-pack" not in command for command in commands[1:])
    commands = nightly.commands_for_batch({"cert": "machine-learning-engineer", "section": "1.", "count": 2},
        "A-card", state_dir=tmp_path, tools=tmp_path, **options)
    assert commands[0][1][commands[0][1].index("--ab-control-pack") + 1] == str(control_path)
    assert "--ab-control-pack" not in commands[1][1]


def test_nightly_config_and_cli_control_pack_path(monkeypatch, tmp_path):
    config = tmp_path / "config.json"
    config.write_text(json.dumps({"ab_control_pack": "config-control.json"}))
    coverage = tmp_path / "coverage.json"
    coverage.write_text("{}")
    seen = []
    monkeypatch.setattr(nightly, "nightly", lambda value, **kw: seen.append(value) or {"status": "planned"})
    args = ["nightly", "--config", str(config), "--coverage", str(coverage),
            "--tools-dir", str(tmp_path), "--state-dir", str(tmp_path)]
    monkeypatch.setattr(sys, "argv", args)
    assert nightly.main() == 0
    assert seen[-1]["ab_control_pack"] == "config-control.json"
    monkeypatch.setattr(sys, "argv", [*args, "--ab-control-pack", "cli-control.json"])
    assert nightly.main() == 0
    assert seen[-1]["ab_control_pack"] == "cli-control.json"


def test_resume_cannot_drop_saved_control_hash(tmp_path, monkeypatch):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    artifact = tmp_path / ".cache/generation/data-engineer-v5-saved.json"
    artifact.parent.mkdir(parents=True)
    artifact.write_text(json.dumps({"cert_id": "data-engineer", "planned_count": 1,
        "plan": [{"objective_id": "test"}], "requested_objective_ids": [],
        "ab_control_pack": {"sha256": "a" * 64}}))
    artifact.with_suffix(".existing.json").write_text("[]")
    with pytest.raises(ValueError, match="Control prompt pack differs"):
        batch.batch_commands("all", "saved", "data-engineer", 1, 1, resume=artifact)


def test_control_and_challenger_never_reach_real_generator_nonwriter_stages(tmp_path, monkeypatch):
    from test_decision_first_v4 import decision, proof
    from test_external_generation import QUESTION, receipts, source
    (control_path, challenger_path), (control, challenger) = packs(tmp_path)
    monkeypatch.setattr(gen, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(gen, "database_client", lambda: pytest.fail("No DB"))
    writer_hashes = []
    nonwriter_states = []
    def planner(scope, **kwargs):
        writer_hashes.append(("plan", prompt_pack.pack_hash(prompt_pack._ACTIVE.get())))
        return {**decision(), "objective_id": scope["objective_id"]}
    def docs(*args, **kwargs):
        nonwriter_states.append(("docs", prompt_pack._ACTIVE.get()))
        return [source()]
    def verifier(*args, **kwargs):
        nonwriter_states.append(("verify", prompt_pack._ACTIVE.get()))
        return {**proof(), "passed": True, "mechanical_check": {"passed": True, "errors": []}}
    def writer(*args, **kwargs):
        writer_hashes.append(("write", prompt_pack.pack_hash(prompt_pack._ACTIVE.get())))
        return QUESTION.copy()
    def citation(*args, **kwargs):
        writer_hashes.append(("cite", prompt_pack.pack_hash(prompt_pack._ACTIVE.get())))
        return {"evidence": receipts()}
    monkeypatch.setattr(gen, "plan_decision", planner)
    monkeypatch.setattr(gen, "search_objective_docs", docs)
    monkeypatch.setattr(gen, "verify_decision", verifier)
    monkeypatch.setattr(gen, "generate_question", writer)
    monkeypatch.setattr(gen, "cite_question", citation)
    artifact = tmp_path / "full-path.json"
    result = CliRunner().invoke(gen.main, ["--n-questions", "2", "--objective", OBJECTIVE,
        "--model", "codex", "--judge-model", "external", "--argon-gate", "--parallel", "1",
        "--continue-quality-rejections", "--artifact", str(artifact), "--prompt-pack", str(challenger_path),
        "--ab-control-pack", str(control_path), "--ab-interleaved", "--ab-experiment", "A-card-transport"])
    assert result.exit_code == 0, result.output
    assert nonwriter_states == [("docs", None), ("verify", None)] * 2
    data = json.loads(artifact.read_text())
    expected = {"control": prompt_pack.pack_hash(control), "challenger": prompt_pack.pack_hash(challenger)}
    for index, candidate in enumerate(data["candidates"]):
        assert writer_hashes[index * 3:index * 3 + 3] == [
            (stage, expected[candidate["ab_assignment"]["arm"]]) for stage in ("plan", "write", "cite")]
    # External judge request only gets frozen scope and candidate; no pack content.
    requests = list(artifact.with_suffix(".judge-requests").glob("*.json"))
    assert requests
    for request in requests:
        text = request.read_text()
        assert LESSON not in text and "Original A decision guidance." not in text
