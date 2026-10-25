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
    from scripts.judge_requests import Summary
    summary = Summary(completed=2)
    runner = Mock(return_value=summary)
    monkeypatch.setattr("scripts.judge_requests.run_requests", runner)
    assert health.live(root, coordinator_approved=True) is summary
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
    assert report["gold"]["pass_rate"] == .8
    assert report["pages"] == ["gold replay incomplete: 0 of 1 judged"]
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


def install_health_replay(monkeypatch, root, manifest, *, blind_failures=1, quality_rejected=False,
                          error_class=health.CLISchemaError, reserve=False):
    """Replay minimal malformed Argon output through the real request runner."""
    from shared import argon_gate, cli_models
    from shared import nightly_budget as guard
    from types import SimpleNamespace
    raw_by_prompt = {}
    blind_attempts = []
    for row in manifest["rows"]:
        request = health.read_json(root / "requests" / (row["candidate_id"] + ".json"))
        raw = synthetic_full_verdict(row, request)
        if quality_rejected:
            raw["style"]["score"] = 0
        for name, gate in request["gates"].items():
            raw_by_prompt[gate["judge_prompt"]] = raw[name]
        for name, gate in request["argon"]["calls"].items():
            raw_by_prompt[gate["judge_prompt"]] = raw["argon"][name]
    monkeypatch.setattr(cli_models, "run_claude_request", lambda model, prompt, schema: raw_by_prompt[prompt])
    def replay(name, gate):
        if reserve:
            guard.reserve_model(argon_gate.MODEL, (), {"prompt": gate["judge_prompt"]},
                                SimpleNamespace(kwargs={"max_tokens": 4000}, num_retries=0), stage="argon_" + name)
        if name == "blind":
            blind_attempts.append(gate["judge_prompt"])
            if len(blind_attempts) <= blind_failures:
                if error_class is health.CLISchemaError:
                    # Minimal shape of the live malformed structured output, no private data.
                    return {"choice": "A"}  # Missing confidence/reason; parse_output raises CLISchemaError.
                raise error_class("synthetic private provider body")
        return raw_by_prompt[gate["judge_prompt"]]
    monkeypatch.setattr(argon_gate, "run_call", replay)
    return blind_attempts


@pytest.mark.parametrize("error_name", ["CLISchemaError", "CLITimeoutError"])
def test_gold_system_error_retries_same_frozen_request_then_succeeds_with_budget(tmp_path, accepted_artifact, monkeypatch, error_name):
    from shared.argon_gate import MODEL
    from shared import cli_models
    from scripts.nightly_budget import load_calls
    root, manifest = cohort(tmp_path, accepted_artifact, gold=True)
    config = tmp_path / "runtime-config.json"
    calls_root = tmp_path / "calls"
    config.write_text(json.dumps({"calls_root": str(calls_root),
                                 "rates": {MODEL: {"input_tokens": "0.1", "output_tokens": "0.2"}}}))
    monkeypatch.setenv("TESTERO_NIGHTLY_CONFIG", str(config))
    before = {p.name: p.read_bytes() for p in (root / "requests").glob("*.json")}
    attempts = install_health_replay(monkeypatch, root, manifest, blind_failures=2, reserve=True,
                                      error_class=getattr(cli_models, error_name))
    result = health.live(root, coordinator_approved=True, parallel=1)
    assert result.completed == 1 and result.failed == result.remaining == 0
    assert len(attempts) == 3 and len(set(attempts)) == 1
    assert before == {name: (root / "requests" / name).read_bytes() for name in before}
    assert not list((root / "verdicts/.failures").glob("*.json"))
    reservations = load_calls(calls_root)
    assert len(reservations) == 4  # Three blind attempts and one successful review.
    assert len({row["budget_call_id"] for row in reservations}) == 4
    report = health.evaluate(root, state=tmp_path / "state.json")
    assert report["complete"] and report["gold"]["pass_rate"] == 1


@pytest.mark.parametrize("gold", [True, False])
def test_exhausted_health_schema_errors_gold_pages_canary_still_stops(tmp_path, accepted_artifact, monkeypatch, gold, capsys):
    root, manifest = cohort(tmp_path, accepted_artifact, gold=gold, per_type=1)
    attempts = install_health_replay(monkeypatch, root, manifest, blind_failures=100)
    code = health.main(["live", "--root", str(root), "--coordinator-approved", "--parallel", "1"])
    assert code == (0 if gold else 1)
    assert len(attempts) == 3 * len(manifest["rows"])
    for row in manifest["rows"]:
        record = health.read_json(root / "verdicts/.failures" / (row["candidate_id"] + ".json"))
        assert record["error_class"] == "CLISchemaError" and record["sub_call"] == "argon.blind"
        assert record["quality_rejected"] is False  # Synthetic seats have no completed veto.
        assert record["message"] == "argon.blind: structured output does not match the current schema"
    capsys.readouterr()
    code = health.main(["evaluate", "--root", str(root), "--state", str(tmp_path / "state.json")])
    report = json.loads(capsys.readouterr().out)
    assert code == (0 if gold else 1)
    assert not report["complete"] and not report["paused"]
    assert report["observed"] == 0 and len(report["errors"]) == len(manifest["rows"])
    if gold:
        assert report["pages"] == ["gold replay incomplete: 0 of 1 judged"]
    else:
        assert all(row["count"] == 0 for row in report["canaries"].values())


@pytest.mark.parametrize("quality_rejected", [True, False])
def test_gold_quality_rejections_never_rerolled(tmp_path, accepted_artifact, monkeypatch, quality_rejected):
    root, manifest = cohort(tmp_path, accepted_artifact, gold=True)
    attempts = install_health_replay(monkeypatch, root, manifest, blind_failures=100 if quality_rejected else 0,
                                      quality_rejected=True)
    result = health.live(root, coordinator_approved=True, parallel=1)
    assert len(attempts) == 1
    assert not health.live_failed(root, result)
    if quality_rejected:
        record = health.read_json(root / "verdicts/.failures" / (manifest["rows"][0]["candidate_id"] + ".json"))
        assert record["quality_rejected"] is True and result.failed == 1
    else:
        assert result.completed == 1 and result.failed == 0
        assert health.evaluate(root, state=tmp_path / "state.json")["gold"]["pass_rate"] == 0


@pytest.mark.parametrize("error_name", ["CLIAuthError", "CLIUsageLimitError", "BudgetError", "RuntimeError"])
def test_gold_auth_quota_budget_unknown_errors_remain_hard_stops(tmp_path, accepted_artifact, monkeypatch, error_name):
    from shared import cli_models
    from scripts.nightly_budget import BudgetError
    root, manifest = cohort(tmp_path, accepted_artifact, gold=True)
    error = BudgetError if error_name == "BudgetError" else RuntimeError if error_name == "RuntimeError" else getattr(cli_models, error_name)
    attempts = install_health_replay(monkeypatch, root, manifest, blind_failures=100, error_class=error)
    assert health.main(["live", "--root", str(root), "--coordinator-approved"]) == 1
    assert len(attempts) == 1


@pytest.mark.parametrize("failing_kind,publish_live", [("gold", False), ("gold", True), ("canaries", False)])
def test_replay_night_incomplete_gold_continues_but_canary_stops(
        tmp_path, accepted_artifact, monkeypatch, failing_kind, publish_live):
    from contextlib import redirect_stdout
    from io import StringIO
    from scripts import pipeline_nightly as nightly, nightly_metrics
    from test_pipeline_nightly import NOW, config, snapshot
    artifact, _ = accepted_artifact
    _, value = config(tmp_path)
    value.update(health_artifacts=[str(artifact)], gold_artifacts=[str(artifact)])
    tools, state = tmp_path / "tools", tmp_path / "state"
    tools.mkdir()
    if publish_live:
        (tools / "PUBLISH_LIVE").touch()
    monkeypatch.setattr(nightly, "preflight", lambda **_: None)
    monkeypatch.setattr(nightly, "export_snapshot", lambda *_: snapshot())
    monkeypatch.setattr(nightly, "publications_today", lambda *_: 0)
    monkeypatch.setattr(nightly_metrics, "batch_metrics", lambda *_: {"published": 0})
    pages = []
    monkeypatch.setattr(nightly, "notify", lambda report, *_a, **_k: pages.extend(report["pages"]))
    seen, attempts = [], {}
    def execute(command, output=None):
        seen.append(command)
        if "scripts.council_health" in command:
            args = command[command.index("scripts.council_health") + 1:]
            if args[0] == "live":
                monitor = Path(args[args.index("--root") + 1])
                _, manifest = health.load_cohort(monitor)
                failing = manifest["kind"] == failing_kind
                attempts[manifest["kind"]] = install_health_replay(
                    monkeypatch, monitor, manifest, blind_failures=100 if failing else 0,
                    quality_rejected=not failing and manifest["kind"] == "canaries")
            buffer = StringIO()
            with redirect_stdout(buffer):
                code = health.main(args)
            if output:
                Path(output).write_text(buffer.getvalue())
            return code
        if "scripts.publish_batch" in command:
            Path(command[command.index("--report") + 1]).write_text(json.dumps({"published": 0, "would_publish": 1}))
        return 0
    result = nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=state, now=NOW,
                             live=True, execute=execute, client=object())
    publishes = [cmd for cmd in seen if "scripts.publish_batch" in cmd]
    if failing_kind == "gold":
        assert result["status"] == "complete" and len(publishes) == 2
        assert all(("--apply" in cmd) is publish_live for cmd in publishes)
        assert not result["health"]["gold-evaluate"]["complete"]
        assert pages == ["gold replay incomplete: 0 of 1 judged"]
        assert len(attempts["gold"]) == 3
    else:
        assert result["status"] == "checkpointed_stop" and not publishes
        assert not any("scripts.run_domain_batch" in cmd for cmd in seen)
        assert len(attempts["canaries"]) == 12  # Four candidates, three attempts each.
        assert not (tools / "PIPELINE_PAUSED").exists()  # Errors are not catches or escapes.


@pytest.mark.parametrize("error_name", ["BudgetError", "CLIAuthError", "CLISchemaError"])
def test_stale_schema_record_cannot_hide_current_retry_persistence_failure(
        tmp_path, accepted_artifact, monkeypatch, error_name):
    from scripts import judge_requests as judge
    from scripts.nightly_budget import BudgetError
    from shared import argon_gate, cli_models
    root, manifest = cohort(tmp_path, accepted_artifact, gold=True)
    attempts = install_health_replay(monkeypatch, root, manifest, blind_failures=100)
    original_run, original_publish = argon_gate.run_call, judge._publish
    current_calls = []
    error = BudgetError if error_name == "BudgetError" else getattr(cli_models, error_name)
    def replay(name, gate):
        current_calls.append(name)
        if name == "blind" and attempts:
            raise error("synthetic private error after first schema failure")
        return original_run(name, gate)
    def publish(path, payload, *, exclusive):
        if path.parent.name == ".failures" and path.exists():
            raise OSError("synthetic failure-record replacement error")
        return original_publish(path, payload, exclusive=exclusive)
    monkeypatch.setattr(argon_gate, "run_call", replay)
    monkeypatch.setattr(judge, "_publish", publish)
    summary = health.live(root, coordinator_approved=True, parallel=1)
    assert summary.persistence_failed and health.live_failed(root, summary)
    assert current_calls == ["blind", "blind"]  # No third attempt after persistence fails.
    stale = health.read_json(root / "verdicts/.failures" / (manifest["rows"][0]["candidate_id"] + ".json"))
    assert stale["error_class"] == "CLISchemaError"  # Stale file is not current safety proof.
