"""Re-export keeps frozen seat configuration; repair does not reroll councils."""
import hashlib
import json
from unittest.mock import Mock

from click.testing import CliRunner
import pytest
from click import ClickException

from scripts import export_judge_requests as exporter
from scripts import ingest_external_verdicts as ingest
from scripts import repair_candidates as repair
from shared.argon_gate import CODEX_MODEL
from test_pde_pipeline_integration import harness


def test_codex_reexport_preserves_request_bytes_and_provenance(harness):
    path, payload, result, _, _ = harness[0](flags=["--argon-gate", "--second-seat-transport", "codex"])
    assert result.exit_code == 0, result.output
    entry = payload["candidates"][0]
    request_path = path.parent / entry["external_judge_request"]["path"]
    original = request_path.read_bytes()
    summary = exporter.export_requests(path)
    assert summary["count"] == 1
    assert request_path.read_bytes() == original
    updated = json.loads(path.read_text())
    frozen = json.loads(original)
    assert frozen["argon"]["model"] == CODEX_MODEL
    assert updated["second_seat_transport"] == "codex"
    assert updated["candidates"][0]["external_judge_request"]["sha256"] == hashlib.sha256(original).hexdigest()
    assert ingest._validate_candidate(path, updated, updated["candidates"][0])
    harness[1].assert_not_called()


@pytest.mark.parametrize("change", ["unknown", "no_council", "legacy_rules"])
def test_invalid_export_transport_fails_before_replacing_outputs(harness, change):
    path, payload, result, _, _ = harness[0](flags=["--argon-gate", "--second-seat-transport", "codex"])
    assert result.exit_code == 0, result.output
    request_path = path.parent / payload["candidates"][0]["external_judge_request"]["path"]
    original = request_path.read_bytes()
    if change == "unknown":
        payload["second_seat_transport"] = "other"
    elif change == "no_council":
        payload["argon_gate"] = False
    else:
        payload["rules_version"] = 4
    path.write_text(json.dumps(payload))
    artifact_bytes = path.read_bytes()
    result = CliRunner().invoke(exporter.main, ["--artifact", str(path), "--force"])
    assert result.exit_code != 0
    assert path.read_bytes() == artifact_bytes
    assert request_path.read_bytes() == original
    harness[1].assert_not_called()


def test_codex_council_repair_remains_explicitly_unsupported(harness, monkeypatch):
    path, payload, result, _, _ = harness[0](flags=["--argon-gate", "--second-seat-transport", "codex"])
    assert result.exit_code == 0, result.output
    cli = Mock(side_effect=AssertionError("Council repair must not call the writer"))
    monkeypatch.setattr(repair.cli_models, "run_signature", cli)
    with pytest.raises(ClickException, match="automatic repair is not supported"):
        repair._validate_repair_payload(path, payload)
    cli.assert_not_called()
