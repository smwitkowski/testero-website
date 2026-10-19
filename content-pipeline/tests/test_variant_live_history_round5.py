"""Cumulative approved 15 priors: offline receipts, not 15 database LIVE rows."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import pytest

from shared import variant_history, variant_live_history as live
from shared.external_judge import canonical_sha256
from shared.variant_plan import REPAIR_MODE, validate_repair_history
from test_variant_live_history import receipt, _write, _sign


def _addition_pin(monkeypatch, payload):
    monkeypatch.setattr(live, "APPROVED_ADDITION_EXPORT_SHA256", canonical_sha256({
        key: payload[key] for key in live._AUTHORIZATION_FIELDS}))


@pytest.fixture
def cumulative(receipt, monkeypatch):
    base_path, base, history, calls = receipt
    addition = deepcopy(base)
    approval = base_path.parent / "approval-r5.md"
    approval.write_text("Two approved offline winners, SQL pending")
    approval_sha = hashlib.sha256(approval.read_bytes()).hexdigest()
    monkeypatch.setattr(live, "ADDITION_APPROVAL_SHA256", approval_sha)
    addition["approval"] = {"path": str(approval), "sha256": approval_sha}
    sql = base_path.parent / "ingest-r5-2.sql"
    sql.write_text("-- two offline rows only")
    addition.update(sql_path=str(sql), sql_sha256=hashlib.sha256(sql.read_bytes()).hexdigest(), count=2,
                    questions=deepcopy(list(live._ADDITION_QUESTIONS)))
    artifact = base_path.parent / "repair-r5-live.json"
    addition["artifacts"] = [{"path": str(artifact), "sha256": _write(artifact, {"fixture": "round5"})}]
    provenance = {"path": str(artifact), "sha256": addition["artifacts"][0]["sha256"],
                  "policy": variant_history.ROUND5_HISTORY_POLICY,
                  "note": variant_history.ROUND5_HISTORY_NOTE,
                  "accepted_variant_ids": [], "judgments": []}
    # Full replay retains two unapproved backups; selection must not include them.
    for question in addition["questions"] + [
        {"id": "backup-a", "parent": "backup-parent", "industry": "backup"},
        {"id": "backup-b", "parent": "backup-parent", "industry": "backup"}]:
        ident = question["id"]
        provenance["accepted_variant_ids"].append(ident)
        provenance["judgments"].append({
            "candidate_id": ident, "request_path": str(artifact.parent / "requests" / (ident + ".json")),
            "request_sha256": "1" * 64,
            "verdict_path": str(artifact.with_suffix(".verdicts") / (ident + ".json")),
            "verdict_sha256": "2" * 64, "accepted": True})
        history["questions"].append({
            "id": ident, "stem": "Which managed service should the organization choose?",
            "key": "Use the appropriate managed service.", "parent_question_id": question["parent"],
            "industry": question["industry"], "source_artifact_path": str(artifact),
            "source_artifact_sha256": provenance["sha256"]})
    history["artifacts"].append(provenance)
    _sign(history)
    variant_history.validate_prior_variants(history)
    _addition_pin(monkeypatch, addition)
    monkeypatch.setattr(live, "BASE_MANIFEST_PATH", str(base_path))
    monkeypatch.setattr(live, "BASE_MANIFEST_SHA256", hashlib.sha256(base_path.read_bytes()).hexdigest())
    monkeypatch.setattr(live, "BASE_MANIFEST_PAYLOAD_SHA256", canonical_sha256(base))
    addition_path = base_path.with_name("practice-ingest-r5-2.json")
    addition_sha = _write(addition_path, addition)
    monkeypatch.setattr(live, "ADDITION_MANIFEST_SHA256", addition_sha)
    monkeypatch.setattr(live, "ADDITION_MANIFEST_PAYLOAD_SHA256", canonical_sha256(addition))
    manifest = {
        "policy": live.CUMULATIVE_LIVE_HISTORY_POLICY,
        "base": {"path": str(base_path), "sha256": live.BASE_MANIFEST_SHA256, "payload": deepcopy(base)},
        "addition": {"path": str(addition_path), "sha256": addition_sha, "payload": addition},
        "count": 15, "artifacts": deepcopy(base["artifacts"] + addition["artifacts"]),
        "questions": deepcopy(base["questions"] + addition["questions"])}
    path = base_path.with_name("practice-ingest-15.json")
    _write(path, manifest)
    return path, manifest, history, calls


def _load(cumulative):
    path, manifest, _, _ = cumulative
    return live.load_live_priors(path, [Path(a["path"]) for a in manifest["artifacts"]])


def test_v1_committed_pins_and_byte_exact_base_are_unchanged():
    path = Path(live.BASE_MANIFEST_PATH)
    payload = json.loads(path.read_text())
    assert live.APPROVED_EXPORT_SHA256 == "128d57e24a3e777be7c23c962577d496a71addfbb26ca75fdca861b4822ed052"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == live.BASE_MANIFEST_SHA256
    assert canonical_sha256(payload) == live.BASE_MANIFEST_PAYLOAD_SHA256
    live._manifest(payload, live.BASE_MANIFEST_SHA256)
    assert live.ADDITION_APPROVAL_SHA256 == "2ab2f0f82534643ab8549baeb0a2fb7524c8f5c2946b138e133d3e7f8a0b4d82"


def test_exact_union_retains_full_replay_and_only_approved_rows(cumulative):
    path, manifest, history, calls = cumulative
    snapshot = _load(cumulative)
    assert snapshot["policy"] == live.CUMULATIVE_LIVE_HISTORY_POLICY
    assert snapshot["history"] == history
    assert len(snapshot["questions"]) == 15
    assert len(snapshot["history"]["questions"]) == 20  # 16 old fixture + 4 round5
    assert len(snapshot["history"]["artifacts"]) == 4
    assert [r["id"] for r in snapshot["questions"]] == [q["id"] for q in manifest["questions"]]
    assert not {"backup-a", "backup-b"} & {r["id"] for r in snapshot["questions"]}
    assert calls == [[Path(a["path"]) for a in manifest["artifacts"]]]
    assert snapshot["manifest"]["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert "13 LIVE plus 2 approved offline, new SQL pending" in snapshot["note"]
    assert variant_history.validate_prior_variants(snapshot) is snapshot
    validate_repair_history({"repair_mode": REPAIR_MODE, "prior_variants": snapshot})


def test_frozen_v2_validation_is_read_free(cumulative, monkeypatch):
    snapshot = json.loads(json.dumps(_load(cumulative)))
    monkeypatch.setattr(Path, "read_bytes", lambda *a, **k: pytest.fail("source read"))
    monkeypatch.setattr(Path, "read_text", lambda *a, **k: pytest.fail("source read"))
    monkeypatch.setattr(variant_history, "load_prior_variants", lambda *a: pytest.fail("replay"))
    assert live.validate_live_priors(snapshot) is snapshot
    assert variant_history.validate_prior_variants(snapshot) is snapshot
    validate_repair_history({"repair_mode": REPAIR_MODE, "prior_variants": snapshot})


@pytest.mark.parametrize("defect", ["drop-base", "base-payload", "base-hash", "base-path", "addition-path",
                                  "addition-hash", "addition-sql", "approval", "id", "parent", "industry",
                                  "backup", "strip-artifact", "artifact-hash", "reorder", "extra-key"])
def test_manifest_tampering_fails_before_replay(cumulative, defect):
    path, manifest, _, calls = cumulative
    if defect == "drop-base":
        del manifest["base"]
    elif defect == "base-payload":
        manifest["base"]["payload"]["purpose"] = "forged metadata"
    elif defect in {"base-hash", "base-path", "addition-path", "addition-hash"}:
        section, field = defect.split("-")
        manifest[section]["sha256" if field == "hash" else "path"] = "0" * 64 if field == "hash" else str(path)
    elif defect == "addition-sql":
        manifest["addition"]["payload"]["sql_sha256"] = "0" * 64
    elif defect == "approval":
        manifest["addition"]["payload"]["approval"]["sha256"] = "0" * 64
    elif defect in {"id", "parent", "industry", "backup"}:
        field = "id" if defect == "backup" else defect
        value = "backup-a" if defect == "backup" else "forged"
        manifest["addition"]["payload"]["questions"][0][field] = value
        manifest["questions"][13][field] = value
    elif defect == "strip-artifact":
        manifest["artifacts"].pop(0)
    elif defect == "artifact-hash":
        manifest["artifacts"][3]["sha256"] = "0" * 64
    elif defect == "reorder":
        manifest["questions"].reverse()
    else:
        manifest["purpose"] = "Not in the contract"
    _write(path, manifest)
    with pytest.raises(ValueError):
        _load(cumulative)
    assert not calls


@pytest.mark.parametrize("field", ["id", "parent", "industry", "approval"])
def test_fixed_two_winners_are_required_even_with_replaced_addition_pin(cumulative, monkeypatch, field):
    path, manifest, _, calls = cumulative
    addition = manifest["addition"]["payload"]
    if field == "approval":
        addition["approval"]["sha256"] = "0" * 64
    else:
        addition["questions"][0][field] = "backup-a"
        manifest["questions"][13][field] = "backup-a"
    _addition_pin(monkeypatch, addition)
    _write(path, manifest)
    with pytest.raises(ValueError, match="two approved round-5 winners"):
        _load(cumulative)
    assert not calls


@pytest.mark.parametrize("index", range(4))
def test_all_four_artifacts_are_required(cumulative, index):
    path, manifest, _, calls = cumulative
    paths = [Path(a["path"]) for a in manifest["artifacts"]]
    paths.pop(index)
    with pytest.raises(ValueError, match="all declared artifacts"):
        live.load_live_priors(path, paths)
    assert not calls


@pytest.mark.parametrize("source", ["base", "addition", "base-sql", "addition-sql", "r5"])
@pytest.mark.parametrize("defect", ["changed", "missing", "symlink"])
def test_receipt_and_evidence_sources_are_hash_checked(cumulative, source, defect):
    _, manifest, _, calls = cumulative
    if source == "r5":
        path = Path(manifest["artifacts"][-1]["path"])
    elif source.endswith("-sql"):
        path = Path(manifest[source.split("-")[0]]["payload"]["sql_path"])
    else:
        path = Path(manifest[source]["path"])
    if defect == "changed":
        path.write_text("{}")
    elif defect == "missing":
        path.unlink()
    else:
        target = path.with_suffix(".target")
        target.write_bytes(path.read_bytes())
        path.unlink()
        path.symlink_to(target)
    with pytest.raises(ValueError):
        _load(cumulative)
    assert not calls


@pytest.mark.parametrize("defect", ["strip-base", "backup", "missing-artifact", "base-hash", "addition-path",
                                  "addition-hash", "addition-metadata"])
def test_frozen_tampering_rejected_after_resign(cumulative, defect):
    snapshot = _load(cumulative)
    if defect == "strip-base":
        del snapshot["manifest"]["payload"]["base"]
    elif defect == "backup":
        snapshot["questions"][-1] = deepcopy(snapshot["history"]["questions"][-1])
    elif defect == "missing-artifact":
        artifact = snapshot["history"]["artifacts"].pop(0)
        snapshot["history"]["questions"] = [r for r in snapshot["history"]["questions"]
                                             if r["source_artifact_path"] != artifact["path"]]
        _sign(snapshot["history"])
    elif defect in {"base-hash", "addition-hash"}:
        section = defect.split("-")[0]
        snapshot["manifest"]["payload"][section]["sha256"] = "0" * 64
    elif defect == "addition-metadata":
        snapshot["manifest"]["payload"]["addition"]["payload"]["purpose"] = "forged metadata"
    else:
        snapshot["manifest"]["payload"]["addition"]["path"] = "/tmp/other.json"
    _sign(snapshot)
    with pytest.raises(ValueError):
        variant_history.validate_prior_variants(snapshot)


def test_source_receipt_changes_during_replay_fail_closed(cumulative, monkeypatch):
    _, manifest, history, _ = cumulative
    def replay(paths):
        Path(manifest["addition"]["path"]).write_text("{}")
        return deepcopy(history)
    monkeypatch.setattr(variant_history, "load_prior_variants", replay)
    with pytest.raises(ValueError, match="changed during replay"):
        _load(cumulative)


def test_unapproved_addition_pin_fails_closed(cumulative, monkeypatch):
    monkeypatch.setattr(live, "APPROVED_ADDITION_EXPORT_SHA256", "UNAPPROVED_PENDING_GENERATED_RECEIPT_PIN")
    with pytest.raises(ValueError, match="addition differs"):
        _load(cumulative)
    assert not cumulative[3]


def test_cumulative_manifest_path_is_bound(cumulative):
    path, manifest, _, calls = cumulative
    alternate = path.with_name("unapproved-copy.json")
    _write(alternate, manifest)
    with pytest.raises(ValueError, match="manifest path"):
        live.load_live_priors(alternate, [Path(a["path"]) for a in manifest["artifacts"]])
    assert not calls


def test_saved_round5_replay_retains_every_accepted_comparison():
    # The saved artifact cache is optional in clean checkouts. Never rewrite it.
    base = json.loads(Path(live.BASE_MANIFEST_PATH).read_text())
    paths = [Path(a["path"]) for a in base["artifacts"]]
    round5 = Path(__file__).resolve().parents[1] / ".cache/variants/repair-r5-live.json"
    if not all(path.is_file() for path in [*paths, round5]):
        pytest.skip("Local frozen four-artifact replay evidence is not present")
    history = variant_history.load_prior_variants([*paths, round5])
    assert len(history["artifacts"]) == 4
    frozen_base = json.loads(round5.read_text())["prior_variants"]["history"]
    prefix = {"artifacts": history["artifacts"][:3],
              "questions": history["questions"][:len(frozen_base["questions"])]}
    _sign(prefix)
    assert prefix == frozen_base  # All original rows, judgments and digest remain exact.
    assert len(history["questions"]) == sum(len(a["accepted_variant_ids"]) for a in history["artifacts"])
    assert history["artifacts"][-1]["policy"] == variant_history.ROUND5_HISTORY_POLICY
    assert set(q["id"] for q in live._ADDITION_QUESTIONS) <= set(history["artifacts"][-1]["accepted_variant_ids"])
    assert len(history["artifacts"][-1]["accepted_variant_ids"]) > len(live._ADDITION_QUESTIONS)
    assert len(history["artifacts"][-1]["judgments"]) >= len(history["artifacts"][-1]["accepted_variant_ids"])
    assert variant_history.validate_prior_variants(json.loads(json.dumps(history))) == history
