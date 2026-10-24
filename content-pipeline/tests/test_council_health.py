"""Offline contracts. Synthetic verdicts are unit tests, not live council proof."""
from copy import deepcopy
import json
from pathlib import Path
import tempfile
from unittest.mock import Mock

import pytest

from scripts import council_health as health
from shared.council_safety import refuse_canary_paths
from shared.external_judge import build_request, candidate_id, canonical_sha256
from shared.option_order import store_options

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def tmp_path():
    # Monitor tests never write default HQ paths or platform-external temp roots.
    root = health.PIPELINE_ROOT / ".cache/council-health-tests"
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="case-", dir=root) as directory:
        yield Path(directory)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    forbidden = Mock(side_effect=AssertionError("No live, DB, or env reads"))
    monkeypatch.setattr("shared.cli_models.run_claude_request", forbidden)
    monkeypatch.setattr("shared.argon_gate.run_call", forbidden)
    monkeypatch.setattr("scripts.ingest_external_verdicts.database_client", forbidden)
    monkeypatch.setattr("dotenv.load_dotenv", forbidden)
    monkeypatch.setattr("dspy.LM", forbidden)


@pytest.fixture
def accepted_artifact(tmp_path):
    # Exact real recorded accepted question, source text, scope and receipts.
    case = json.loads((FIXTURES / "bank_grounding_replay.json").read_text())["cases"][0]
    assert case["accepted"] is True
    question, scope = case["question"], case["scope"]
    entry = {"index": 1, "candidate_id": candidate_id(1, scope, question),
             "stem": question["stem"], "sources": case["sources"], "accepted": True}
    store_options(entry, question, case["evidence"])
    artifact = tmp_path / "accepted.json"
    artifact.write_text(json.dumps({"plan": [scope], "candidates": [entry]}))
    return artifact, case


def cohort(tmp_path, accepted_artifact, **kwargs):
    artifact, _ = accepted_artifact
    root = tmp_path / "cohort"
    health.prepare([artifact], root, **kwargs)
    return root, json.loads((root / "manifest.json").read_text())


def test_prepare_real_accepted_sources_same_shape_hidden_identities(tmp_path, accepted_artifact):
    artifact, case = accepted_artifact
    before = artifact.read_bytes()
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=2)
    assert artifact.read_bytes() == before
    assert (root / ".council-canaries").is_file()
    assert len(manifest["rows"]) == 4
    assert len(list((root / "requests").glob("*.json"))) == 4
    for row in manifest["rows"]:
        request = json.loads((root / "requests" / (row["candidate_id"] + ".json")).read_text())
        normal = build_request(row["candidate_id"], row["scope"], row["question"],
                               row["entry"]["sources"], health.canonical_evidence(row["entry"]),
                               gate_version=5, argon_gate=True, execution_policy="short_circuit_v2")
        assert request == normal
        assert request["argon"]["version"] == 3
        assert set(request["argon"]["calls"]) == {"blind", "review"}
        assert set(request) == set(normal)
        text = json.dumps(request).lower()
        assert not any(name in text for name in ("canary", "swapped_key", "retired_name", "accepted.json"))
        assert row["source_sha256"] == health.hashlib.sha256(before).hexdigest()
    assert {row["defect"] for row in manifest["rows"]} == set(health.DEFECTS)
    assert not (root / "verdicts").exists()


def test_seed_is_repeatable_but_different_seed_changes_cohort(tmp_path, accepted_artifact):
    artifact, _ = accepted_artifact
    for folder, seed in (("one", 45), ("two", 45), ("three", 77)):
        health.prepare([artifact], tmp_path / folder, per_type=3, seed=seed)
    first = (tmp_path / "one/manifest.json").read_bytes()
    assert first == (tmp_path / "two/manifest.json").read_bytes()
    assert first != (tmp_path / "three/manifest.json").read_bytes()


def test_mutations_swap_option_receipts_and_inject_real_lexicon(accepted_artifact):
    _, case = accepted_artifact
    original = deepcopy(case["question"])
    mutated, receipts = health.mutate(original, case["evidence"], "swapped_key",
                                      rng=health.random.Random(45), products=[])
    assert mutated["correct_answer"] in [original["distractor_" + str(n)] for n in (1, 2, 3)]
    assert mutated["correct_answer"] != original["correct_answer"]
    assert sorted(row["option_label"] for row in receipts) == list("ABCD")
    assert original == case["question"]
    from shared.product_freshness import freshness_errors
    products = json.loads((health.PIPELINE_ROOT / "certs/product-lexicon.json").read_text())["products"]
    stale, _ = health.mutate(original, case["evidence"], "retired_name",
                            rng=health.random.Random(45), products=products)
    assert freshness_errors(stale)


def test_no_accepted_source_or_overwrite(tmp_path, accepted_artifact):
    artifact, _ = accepted_artifact
    payload = json.loads(artifact.read_text())
    payload["candidates"][0]["accepted"] = False
    artifact.write_text(json.dumps(payload))
    with pytest.raises(ValueError, match="No accepted"):
        health.prepare([artifact], tmp_path / "out")
    (tmp_path / "exists").mkdir()
    with pytest.raises(ValueError, match="fresh"):
        health.prepare([artifact], tmp_path / "exists")


def test_canary_hard_refusal_before_db_including_dry_run(tmp_path, accepted_artifact):
    from click.testing import CliRunner
    from scripts import ingest_external_verdicts as ingest
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=1)
    row = manifest["rows"][0]
    artifact = root / "attempt.json"
    artifact.write_text(json.dumps({"plan": [row["scope"]], "candidates": [row["entry"]]}))
    for path in (root, artifact, root / "requests" / "future.json"):
        with pytest.raises(ValueError, match="canaries"):
            refuse_canary_paths(path)
    (root / "verdicts").mkdir()
    result = CliRunner().invoke(ingest.main, ["--artifact", str(artifact),
                                             "--verdicts", str(root / "verdicts"), "--dry-run"])
    assert result.exit_code != 0
    assert "canaries cannot reach ingest" in (result.output + str(result.exception)).lower()


def test_marker_and_request_tamper_refused(tmp_path, accepted_artifact):
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=1)
    path = root / "requests" / (manifest["rows"][0]["candidate_id"] + ".json")
    request = json.loads(path.read_text())
    request["objective_id"] = "changed"
    path.write_text(json.dumps(request))
    with pytest.raises(ValueError, match="changed"):
        health.evaluate(root, state=tmp_path / "state.json")
    (root / ".council-canaries").unlink()
    with pytest.raises(ValueError, match="marker"):
        health.load_cohort(root)


def install_unit_observations(monkeypatch, root, manifest, would_publish):
    """Synthetic observation boundary only; never claim these measure model quality."""
    (root / "verdicts").mkdir(exist_ok=True)
    for row in manifest["rows"]:
        (root / "verdicts" / (row["candidate_id"] + ".json")).write_text("{}")
    monkeypatch.setattr(health, "validate_observation", lambda *args: None)
    monkeypatch.setattr(health, "publication_errors", lambda q, s, r, v:
                        [] if would_publish else ["Synthetic strict rejection"])


def test_missing_or_malformed_verdicts_are_errors_not_catches(tmp_path, accepted_artifact):
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=1)
    state = tmp_path / "state.json"
    report = health.evaluate(root, state=state)
    assert len(report["errors"]) == 2
    assert not report["complete"] and not report["paused"]
    assert all(row["count"] == 0 for row in report["canaries"].values())
    (root / "verdicts").mkdir()
    for row in manifest["rows"]:
        (root / "verdicts" / (row["candidate_id"] + ".json")).write_text("{}")
    report = health.evaluate(root, state=state)
    assert len(report["errors"]) == 2
    assert all(row["count"] == 0 for row in report["canaries"].values())


def test_any_escape_pauses_even_before_full_window(tmp_path, accepted_artifact, monkeypatch):
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=1)
    install_unit_observations(monkeypatch, root, manifest, True)
    report = health.evaluate(root, state=tmp_path / "state.json")
    assert report["paused"] and len(report["pause_reasons"]) == 2
    assert (tmp_path / "PIPELINE_PAUSED").is_file()
    assert all(not row["full"] for row in report["canaries"].values())


@pytest.mark.parametrize("escapes,paused", [(0, False), (1, False), (2, True)])
def test_full_window_threshold_exact_95_percent(tmp_path, accepted_artifact, monkeypatch, escapes, paused):
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=1)
    # Seed prior observations, then evaluate an incomplete new cohort.
    prior = [{"id": str(n), "would_publish": n < escapes} for n in range(20)]
    state = tmp_path / "state.json"
    health.write_json(state, {"version": 1, "windows": {d: prior for d in health.DEFECTS}, "gold": [], "seen": []})
    report = health.evaluate(root, state=state)
    assert report["paused"] is paused
    assert all(row["count"] == 20 for row in report["canaries"].values())


def test_duplicate_evaluation_does_not_inflate_catch_counts(tmp_path, accepted_artifact, monkeypatch):
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=3)
    install_unit_observations(monkeypatch, root, manifest, False)
    state = tmp_path / "state.json"
    first = health.evaluate(root, state=state)
    second = health.evaluate(root, state=state)
    assert first["canaries"] == second["canaries"]
    assert all(row["count"] == 3 for row in second["canaries"].values())


def test_gold_under_80_pages_not_pauses(tmp_path, accepted_artifact, monkeypatch):
    root, manifest = cohort(tmp_path, accepted_artifact, gold=True)
    assert len(manifest["rows"]) == 1 and manifest["rows"][0]["defect"] is None
    install_unit_observations(monkeypatch, root, manifest, False)
    report = health.evaluate(root, state=tmp_path / "state.json")
    assert report["gold"]["pass_rate"] == 0
    assert report["pages"] == ["Gold replay pass rate below 80%"]
    assert not report["paused"] and not (tmp_path / "PIPELINE_PAUSED").exists()


def test_minimum_window_and_live_explicit_approval(tmp_path):
    with pytest.raises(ValueError, match="at least 20"):
        health.evaluate(tmp_path, window=19)
    with pytest.raises(ValueError, match="coordinator"):
        health.live(tmp_path)
    with pytest.raises(ValueError, match="Duplicate"):
        path = tmp_path / "duplicate.json"
        path.write_text('{"a":1,"a":2}')
        health.read_json(path)


def test_real_frozen_blind_verdict_replay_catches_swapped_key():
    # Actual recorded v5 question/verdict, not a fabricated live canary result.
    from shared.gates import evaluate_gate, blind_choice_map
    batches = json.loads((FIXTURES / "efficiency-judge-replay.json").read_text())
    row = batches[0]["rows"][0]
    question, raw = row["question"], row["verdict"]
    assert evaluate_gate("blind_solver", raw["blind_solver"], question, version=5)[0]
    mutated, _ = health.mutate(question, [], "swapped_key", rng=health.random.Random(45), products=[])
    # Transport the actual recorded selected option TEXT through the new shuffle.
    # This is a deterministic replay transform, not a new model response.
    for recorded in (raw["blind_solver"], raw["argon"]["blind"]):
        assert evaluate_gate("blind_solver", recorded, question, version=5)[0]
        selected_text = question[health.OPTION_FIELDS["ABCD".index(blind_choice_map(question)[recorded["choice"]])]]
        new_origin = "ABCD"[[mutated[field] for field in health.OPTION_FIELDS].index(selected_text)]
        mapped = {**recorded, "choice": next(label for label, origin in blind_choice_map(mutated).items() if origin == new_origin)}
        assert not evaluate_gate("blind_solver", mapped, mutated, version=5)[0]


def test_legacy_frozen_review_only_never_counts_as_publish():
    request = json.loads((FIXTURES / "v5-smoke3-argon-request.json").read_text())
    prompt = request["gates"]["evidence"]["judge_prompt"].split("\n\nUSER:\n", 1)[-1]
    question = json.JSONDecoder().raw_decode(prompt.split("[[ ## question_data ## ]]", 1)[1].lstrip())[0]
    errors = health.publication_errors(question, {"objective_id": request["objective_id"]}, request, {})
    assert errors


def synthetic_full_verdict(row, request):
    """A rubber-stamping synthetic council. Never a live model-quality receipt."""
    from shared.gates import blind_choice_map
    raw = deepcopy(json.loads((FIXTURES / "efficiency-judge-replay.json").read_text())[0]["rows"][0]["verdict"])
    choice = next(label for label, origin in blind_choice_map(row["question"]).items() if origin == "A")
    raw["blind_solver"].update(choice=choice, confidence=.99)
    raw["argon"]["blind"].update(choice=choice, confidence=.99)
    raw["style"]["score"] = .99
    raw["evidence"]["score"] = .99
    raw["argon"].update(version=request["argon"]["version"], request_sha256=canonical_sha256(request["argon"]))
    return raw


def test_strict_helper_integration_rubber_stamp_escapes_but_lexicon_catches(tmp_path, accepted_artifact):
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=1)
    (root / "verdicts").mkdir()
    for row in manifest["rows"]:
        request = json.loads((root / "requests" / (row["candidate_id"] + ".json")).read_text())
        raw = synthetic_full_verdict(row, request)
        (root / "verdicts" / (row["candidate_id"] + ".json")).write_text(json.dumps(raw))
    report = health.evaluate(root, state=tmp_path / "state.json")
    assert report["complete"] and not report["errors"]
    assert report["canaries"]["swapped_key"]["catch_rate"] == 0
    assert report["canaries"]["retired_name"]["catch_rate"] == 1
    assert report["paused"]


def test_gold_strict_helper_passes_complete_valid_unit_verdict(tmp_path, accepted_artifact):
    root, manifest = cohort(tmp_path, accepted_artifact, gold=True)
    (root / "verdicts").mkdir()
    row = manifest["rows"][0]
    request = json.loads((root / "requests" / (row["candidate_id"] + ".json")).read_text())
    (root / "verdicts" / (row["candidate_id"] + ".json")).write_text(json.dumps(synthetic_full_verdict(row, request)))
    report = health.evaluate(root, state=tmp_path / "state.json")
    assert report["complete"] and report["gold"]["pass_rate"] == 1
    assert not report["pages"] and not report["paused"]


def test_changed_replay_escape_still_pauses(tmp_path, accepted_artifact, monkeypatch):
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=1)
    install_unit_observations(monkeypatch, root, manifest, False)
    state = tmp_path / "state.json"
    assert not health.evaluate(root, state=state)["paused"]
    monkeypatch.setattr(health, "publication_errors", lambda *args: [])
    assert health.evaluate(root, state=state)["paused"]


def test_coordinator_live_only_dispatches_full_judging(tmp_path, accepted_artifact, monkeypatch):
    root, _ = cohort(tmp_path, accepted_artifact, per_type=1)
    runner = Mock(return_value="unit-only")
    monkeypatch.setattr("scripts.judge_requests.run_requests", runner)
    assert health.live(root, coordinator_approved=True) == "unit-only"
    runner.assert_called_once_with(root / "requests", root / "verdicts", judge_model="claude", parallel=2,
                                   argon_gate=True, full_gate_sample=1)


def test_symlink_cannot_hide_monitor_ancestor(tmp_path, accepted_artifact):
    root, _ = cohort(tmp_path, accepted_artifact, per_type=1)
    linked = tmp_path / "linked"
    linked.symlink_to(root, target_is_directory=True)
    with pytest.raises(ValueError, match="symlink"):
        refuse_canary_paths(linked / "requests/anything.json")
    with pytest.raises(ValueError, match="symlink"):
        health.load_cohort(linked)


def test_dangling_marker_still_blocks_database_paths(tmp_path):
    root = tmp_path / "monitor"
    root.mkdir()
    (root / ".council-canaries").symlink_to(root / "missing")
    with pytest.raises(ValueError, match="canaries"):
        refuse_canary_paths(root / "artifact.json")


def test_gold_exact_80_percent_does_not_page(tmp_path, accepted_artifact):
    root, _ = cohort(tmp_path, accepted_artifact, gold=True)
    state = tmp_path / "state.json"
    health.write_json(state, {"version": 1, "windows": {d: [] for d in health.DEFECTS},
                              "gold": [{"would_publish": n < 16} for n in range(20)], "seen": []})
    report = health.evaluate(root, state=state)
    assert report["gold"]["pass_rate"] == .8 and report["pages"] == []
    assert not report["paused"]


def test_changed_frozen_verdict_does_not_add_a_catch(tmp_path, accepted_artifact, monkeypatch):
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=1)
    install_unit_observations(monkeypatch, root, manifest, False)
    state = tmp_path / "state.json"
    assert health.evaluate(root, state=state)["complete"]
    row = manifest["rows"][0]
    (root / "verdicts" / (row["candidate_id"] + ".json")).write_text('{"changed":true}')
    report = health.evaluate(root, state=state)
    assert not report["complete"]
    assert report["errors"][0]["error_class"] == "FrozenVerdictChanged"
    assert report["canaries"]["swapped_key"]["count"] == 1


def test_escape_then_malformed_seat_still_writes_pause(tmp_path, accepted_artifact):
    root, manifest = cohort(tmp_path, accepted_artifact, per_type=1)
    (root / "verdicts").mkdir()
    for index, row in enumerate(manifest["rows"]):
        request = json.loads((root / "requests" / (row["candidate_id"] + ".json")).read_text())
        raw = synthetic_full_verdict(row, request)
        if index == 1:
            # parse_gate_output raises CLISchemaError (RuntimeError), not ValueError.
            raw["style"].pop("decision_level")
        (root / "verdicts" / (row["candidate_id"] + ".json")).write_text(json.dumps(raw))
    assert manifest["rows"][0]["defect"] == "swapped_key"
    report = health.evaluate(root, state=tmp_path / "state.json")
    assert report["paused"] and (tmp_path / "PIPELINE_PAUSED").is_file()
    assert not report["complete"] and len(report["errors"]) == 1
    assert report["errors"][0]["error_class"] == "CLISchemaError"
    assert report["canaries"]["swapped_key"]["count"] == 1
    assert report["canaries"]["retired_name"]["count"] == 0
