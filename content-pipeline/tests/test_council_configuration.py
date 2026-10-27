"""Offline configuration isolation. Synthetic receipts are not live health proof."""
from copy import deepcopy
import json
from unittest.mock import Mock

import pytest

from scripts import council_health as health, publish_batch as publisher
from shared import council_configuration as configuration
from shared.argon_gate import MODEL, CODEX_MODEL, run_call as real_run_call
from shared.external_judge import canonical_sha256
from test_council_health import (accepted_artifact, tmp_path, offline,
                                  install_unit_observations, synthetic_full_verdict)
from test_publish_batch_v6 import publish_case, case, v4


def prepare(tmp_path, accepted_artifact, name, **kwargs):
    artifact, _ = accepted_artifact
    root = tmp_path / name
    health.prepare([artifact], root, second_seat_transport="codex", **kwargs)
    return root, health.read_json(root / "manifest.json")


def ready(tmp_path, accepted_artifact, monkeypatch):
    state = tmp_path / "health.json"
    root, manifest = prepare(tmp_path, accepted_artifact, "canaries", per_type=20)
    install_unit_observations(monkeypatch, root, manifest, False)
    result = health.evaluate(root, state=state, second_seat_transport="codex")
    assert result["complete"] and not result["paused"]
    root, manifest = prepare(tmp_path, accepted_artifact, "gold", gold=True)
    install_unit_observations(monkeypatch, root, manifest, True)
    health.evaluate(root, state=state, second_seat_transport="codex")
    return state


def test_legacy_state_migrates_only_to_argon(tmp_path, accepted_artifact):
    state = tmp_path / "health.json"
    legacy = configuration.empty_health()
    legacy["windows"]["swapped_key"] = [{"would_publish": False}]
    health.write_json(state, legacy)
    root, _ = prepare(tmp_path, accepted_artifact, "cohort", per_type=1)
    health.evaluate(root, state=state, second_seat_transport="codex")
    saved = health.read_json(state)
    assert saved["version"] == 2
    assert saved["configurations"][MODEL] == legacy
    assert saved["configurations"][CODEX_MODEL]["windows"]["swapped_key"] == []
    assert configuration.readiness_errors(state=state, pause=tmp_path / "pause",
                                           second_seat_transport="codex")


def test_codex_requires_own_complete_100_percent_canaries_and_gold(tmp_path, accepted_artifact, monkeypatch):
    state = tmp_path / "health.json"
    pause = tmp_path / "PIPELINE_PAUSED"
    assert configuration.readiness_errors(state=state, pause=pause, second_seat_transport="codex")
    assert not configuration.readiness_errors(state=state, pause=pause)
    root, manifest = prepare(tmp_path, accepted_artifact, "partial", per_type=19)
    install_unit_observations(monkeypatch, root, manifest, False)
    health.evaluate(root, state=state, second_seat_transport="codex")
    assert configuration.readiness_errors(state=state, pause=pause, second_seat_transport="codex")
    state = ready(tmp_path, accepted_artifact, monkeypatch)
    assert not configuration.readiness_errors(state=state, pause=pause, second_seat_transport="codex")
    saved = health.read_json(state)
    bootstrap = saved["configurations"][CODEX_MODEL]["bootstrap"]
    assert bootstrap["canaries"]["model"] == bootstrap["gold"]["model"] == CODEX_MODEL
    # Argon receipts cannot grant readiness even if manually moved into Codex's slot.
    bootstrap["canaries"]["model"] = MODEL
    health.write_json(state, saved)
    with pytest.raises(ValueError, match="not ready"):
        configuration.require_ready(state=state, pause=pause, second_seat_transport="codex")


def test_incomplete_gold_does_not_bootstrap(tmp_path, accepted_artifact, monkeypatch):
    state = ready(tmp_path, accepted_artifact, monkeypatch)
    saved = health.read_json(state)
    del saved["configurations"][CODEX_MODEL]["bootstrap"]["gold"]
    health.write_json(state, saved)
    root, _ = prepare(tmp_path, accepted_artifact, "missing-gold", gold=True)
    report = health.evaluate(root, state=state, second_seat_transport="codex")
    assert not report["complete"]
    assert configuration.readiness_errors(state=state, pause=tmp_path / "pause", second_seat_transport="codex")


def test_configuration_pause_separation_and_global_manual_stop(tmp_path, accepted_artifact, monkeypatch):
    pause = tmp_path / "PIPELINE_PAUSED"
    root, manifest = prepare(tmp_path, accepted_artifact, "escape", per_type=1)
    install_unit_observations(monkeypatch, root, manifest, True)
    health.evaluate(root, state=tmp_path / "health.json", pause=pause, second_seat_transport="codex")
    assert configuration.is_paused(pause=pause, second_seat_transport="codex")
    assert not configuration.is_paused(pause=pause)
    configuration.pause_path(pause, "codex").unlink()
    # Legacy health pauses are attributed only to Argon.
    health.write_json(pause, {"at": "old", "reasons": ["canary escape"]})
    assert configuration.is_paused(pause=pause)
    assert not configuration.is_paused(pause=pause, second_seat_transport="codex")
    pause.write_text("")
    assert configuration.is_paused(pause=pause)
    assert configuration.is_paused(pause=pause, second_seat_transport="codex")


def test_mixed_monitor_models_and_selected_transport_mismatch_rejected(tmp_path, accepted_artifact):
    root, manifest = prepare(tmp_path, accepted_artifact, "mixed", per_type=1)
    with pytest.raises(ValueError, match="configuration"):
        health.evaluate(root, state=tmp_path / "health.json")
    row = manifest["rows"][0]
    path = root / "requests" / (row["candidate_id"] + ".json")
    request = health.read_json(path)
    request["argon"]["model"] = MODEL
    health.write_json(path, request)
    row["request_sha256"] = canonical_sha256(request)
    health.write_json(root / "manifest.json", manifest)
    with pytest.raises(ValueError, match="changed"):
        health.load_cohort(root)


def test_frozen_codex_verdict_passes_pure_gate_without_health_io(tmp_path, accepted_artifact, monkeypatch):
    root, manifest = prepare(tmp_path, accepted_artifact, "pure", gold=True)
    row = manifest["rows"][0]
    request = health.read_json(root / "requests" / (row["candidate_id"] + ".json"))
    raw = synthetic_full_verdict(row, request)
    raw["argon"]["model"] = CODEX_MODEL
    monkeypatch.setattr(configuration, "readiness_errors", Mock(side_effect=AssertionError("pure helper must not read health")))
    assert not publisher.publication_errors(row["question"], row["scope"], request, raw)
    raw["argon"]["model"] = MODEL
    assert publisher.publication_errors(row["question"], row["scope"], request, raw)


def test_apply_rechecks_codex_health_from_bound_request_not_report(tmp_path, accepted_artifact):
    root, manifest = prepare(tmp_path, accepted_artifact, "apply", gold=True)
    path = root / "requests" / (manifest["rows"][0]["candidate_id"] + ".json")
    # Test the apply boundary with an ordinary isolated frozen request path.
    ordinary = tmp_path / "request.json"
    ordinary.write_bytes(path.read_bytes())
    client = Mock()
    report = {"published": 0, "candidates": [{"would_publish": True, "model": MODEL}]}
    with pytest.raises(ValueError, match="not ready"):
        publisher.apply_publication(client, report, [(ordinary, publisher._sha(ordinary))],
                                    health_state=tmp_path / "missing.json")
    client.rpc.assert_not_called()


def test_publisher_plan_codex_not_ready_even_with_passing_council(publish_case, tmp_path, monkeypatch):
    case, payload, question, scope, request, raw, row = publish_case
    request["argon"]["model"] = CODEX_MODEL
    raw["argon"].update(model=CODEX_MODEL, request_sha256=canonical_sha256(request["argon"]))
    path = case[6]
    path.write_text(json.dumps(request))
    payload["candidates"][0]["external_judge_request"]["sha256"] = publisher._sha(path)
    payload["second_seat_transport"] = "codex"
    payload["candidates"][0]["external_verdict"] = deepcopy(raw)
    case[0].write_text(json.dumps(payload))
    (case[1] / path.name).write_text(json.dumps(raw))
    report, _ = publisher.plan_publication(case[0], case[1], [row], health_state=tmp_path / "missing.json")
    assert report["would_publish"] == 0
    assert "council_configuration_not_ready" in report["candidates"][0]["reasons"]


def test_health_never_overwrites_manual_global_pause(tmp_path, accepted_artifact, monkeypatch):
    artifact, _ = accepted_artifact
    root = tmp_path / "argon-escape"
    health.prepare([artifact], root, per_type=1)
    manifest = health.read_json(root / "manifest.json")
    install_unit_observations(monkeypatch, root, manifest, True)
    pause = tmp_path / "PIPELINE_PAUSED"
    pause.write_text("manual coordinator stop")
    health.evaluate(root, state=tmp_path / "health.json", pause=pause)
    assert pause.read_text() == "manual coordinator stop"
    pause.unlink()
    assert configuration.is_paused(pause=pause)
    assert not configuration.is_paused(pause=pause, second_seat_transport="codex")


def test_codex_full_health_runner_replays_exact_prompts_without_paid_calls(tmp_path, accepted_artifact, monkeypatch):
    from shared import cli_models, nightly_budget
    root, manifest = prepare(tmp_path, accepted_artifact, "codex-live-replay", gold=True)
    row = manifest["rows"][0]
    request = health.read_json(root / "requests" / (row["candidate_id"] + ".json"))
    raw = synthetic_full_verdict(row, request)
    by_prompt = {gate["judge_prompt"]: raw[name] for name, gate in request["gates"].items()}
    by_prompt.update({gate["judge_prompt"]: raw["argon"][name]
                      for name, gate in request["argon"]["calls"].items()})
    monkeypatch.setattr(cli_models, "run_claude_request", lambda model, prompt, schema: by_prompt[prompt])
    calls = []
    def signature(model, schema, inputs, *, frozen_prompt):
        calls.append((model, inputs, frozen_prompt))
        return by_prompt[frozen_prompt]
    monkeypatch.setattr(cli_models, "run_signature", signature)
    # The inherited offline guard disables run_call; restore only this dispatch
    # function with both underlying transports still mocked/forbidden.
    monkeypatch.setattr("shared.argon_gate.run_call", real_run_call)
    forbidden = Mock(side_effect=AssertionError("No paid model path"))
    monkeypatch.setattr(nightly_budget, "reserve_model", forbidden)
    monkeypatch.setattr("shared.llm_generator._generation_lm", forbidden)
    result = health.live(root, coordinator_approved=True, parallel=1, second_seat_transport="codex")
    assert result.completed == 1 and not result.failed
    assert [(model, inputs) for model, inputs, _ in calls] == [(CODEX_MODEL, {}), (CODEX_MODEL, {})]
    assert [prompt for _, _, prompt in calls] == [request["argon"]["calls"][name]["judge_prompt"]
                                                 for name in ("blind", "review")]
    recorded = health.read_json(root / "verdicts" / (row["candidate_id"] + ".json"))
    assert recorded["argon"]["model"] == CODEX_MODEL
    report = health.evaluate(root, state=tmp_path / "health.json", second_seat_transport="codex")
    assert report["complete"] and report["gold"]["pass_rate"] == 1
    forbidden.assert_not_called()


@pytest.mark.parametrize("field,value", [("count", True), ("catch_rate", True), ("catch_rate", 1.1)])
def test_bootstrap_receipt_types_are_strict(tmp_path, accepted_artifact, monkeypatch, field, value):
    state = ready(tmp_path, accepted_artifact, monkeypatch)
    saved = health.read_json(state)
    saved["configurations"][CODEX_MODEL]["bootstrap"]["canaries"]["canaries"]["swapped_key"][field] = value
    health.write_json(state, saved)
    assert configuration.readiness_errors(state=state, pause=tmp_path / "pause", second_seat_transport="codex")


def test_codex_pause_symlink_fails_closed(tmp_path):
    pause = tmp_path / "PIPELINE_PAUSED"
    configuration.pause_path(pause, "codex").symlink_to(tmp_path / "missing")
    assert configuration.is_paused(pause=pause, second_seat_transport="codex")


def test_codex_ready_publication_allows_mock_apply_but_rechecks_new_pause(publish_case, tmp_path, accepted_artifact, monkeypatch):
    from types import SimpleNamespace
    case, payload, question, scope, request, raw, row = publish_case
    request["argon"]["model"] = CODEX_MODEL
    raw["argon"].update(model=CODEX_MODEL, request_sha256=canonical_sha256(request["argon"]))
    path = case[6]
    path.write_text(json.dumps(request))
    payload["candidates"][0]["external_judge_request"]["sha256"] = publisher._sha(path)
    payload["second_seat_transport"] = "codex"
    payload["candidates"][0]["external_verdict"] = deepcopy(raw)
    case[0].write_text(json.dumps(payload))
    (case[1] / path.name).write_text(json.dumps(raw))
    state = ready(tmp_path, accepted_artifact, monkeypatch)
    report, bindings = publisher.plan_publication(case[0], case[1], [row], health_state=state)
    assert report["would_publish"] == 1, report
    client = Mock()
    pause = tmp_path / "PIPELINE_PAUSED"
    pause.write_text("manual stop after planning")
    with pytest.raises(ValueError, match="paused"):
        publisher.apply_publication(client, report, bindings, health_state=state)
    client.rpc.assert_not_called()
    pause.unlink()
    scoped = configuration.pause_path(pause, "codex")
    def checkpoint(current):
        if current["candidates"][0].get("write_status") == "unknown":
            scoped.write_text("pause created during durable checkpoint")
    with pytest.raises(ValueError, match="paused"):
        publisher.apply_publication(client, deepcopy(report), bindings,
                                    health_state=state, checkpoint=checkpoint)
    client.rpc.assert_not_called()
    scoped.unlink()
    client.rpc.return_value.execute.return_value = SimpleNamespace(data={"changed": True})
    publisher.apply_publication(client, report, bindings, health_state=state)
    assert report["published"] == 1
