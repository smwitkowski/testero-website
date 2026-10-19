"""Live A/B authorization uses complete, fresh claim evidence only."""
import hashlib

import pytest
from scripts import run_retrieval_ab as runner


@pytest.fixture
def report(tmp_path, monkeypatch):
    monkeypatch.setattr(runner, "ROOT", tmp_path)
    artifacts = {}
    for arm in ("baseline", "treatment"):
        path = tmp_path / ".cache/generation/retrieval-1019-b" / f"{arm}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(arm)
        artifacts[arm] = hashlib.sha256(path.read_bytes()).hexdigest()
    monkeypatch.setattr(runner, "EXPECTED_ARTIFACTS", artifacts)
    ledger = tmp_path / "ledger.json"
    ledger.write_text("[]")
    return {"complete_attempt_coverage": True, "complete_field_coverage": True,
            "gate_passed": True, "claim_support_recall": .95,
            "by_arm": {arm: {"recall": .95} for arm in artifacts},
            "implementation_sha256": "current", "config": runner.DEFAULT_CONFIG.__dict__,
            "budget_chars": runner.DEFAULT_CONTEXT_CHARS, "artifacts": artifacts,
            "ledgers": {str(ledger): hashlib.sha256(ledger.read_bytes()).hexdigest()}}


def test_fresh_complete_claim_report_authorizes(report):
    assert runner.claim_gate_passed(report, "current")


@pytest.mark.parametrize("field,value", [
    ("complete_attempt_coverage", False), ("complete_field_coverage", False),
    ("gate_passed", False), ("claim_support_recall", .949),
    ("implementation_sha256", "stale"), ("config", {}),
    ("budget_chars", 1), ("artifacts", {}), ("ledgers", {}),
    ("by_arm", {"baseline": {"recall": .99}, "treatment": {"recall": .94}}),
])
def test_incomplete_failed_or_stale_report_rejected(report, field, value):
    report[field] = value
    assert not runner.claim_gate_passed(report, "current")


@pytest.mark.parametrize("source", ["ledger", "artifact"])
def test_input_digest_rechecked(report, source):
    path = (next(iter(report["ledgers"])) if source == "ledger" else
            runner.ROOT / ".cache/generation/retrieval-1019-b/baseline.json")
    from pathlib import Path
    Path(path).write_text("changed")
    assert not runner.claim_gate_passed(report, "current")


def test_dry_plan_and_explicit_override(tmp_path, monkeypatch, capsys):
    bank = tmp_path / "bank.json"
    bank.write_text("[]")
    args = ["run_retrieval_ab", "--bank", str(bank), "--tag", "claim-gate-test"]
    monkeypatch.setattr("sys.argv", args)
    runner.main()
    assert "DRY PLAN ONLY" in capsys.readouterr().out
    monkeypatch.setattr("sys.argv", args + ["--execute"])
    with pytest.raises(SystemExit):
        runner.main()
    monkeypatch.setattr(runner.Path, "mkdir", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("authorized")))
    monkeypatch.setattr("sys.argv", args + ["--execute", "--allow-failed-recall"])
    with pytest.raises(RuntimeError, match="authorized"):
        runner.main()
