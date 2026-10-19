"""Offline approved-export selection; no database or model calls."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import pytest

from shared.external_judge import canonical_sha256
from shared import variant_history, variant_live_history as live
from test_variant_history import prior
from test_variants import parents


COMMITTED_MANIFEST = (Path(__file__).resolve().parents[1]
                      / "calibration/variants-2026-10-19/practice-ingest-13.json")


def _write(path, value):
    path.write_text(json.dumps(value))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _sign(value):
    value["snapshot_sha256"] = canonical_sha256({
        key: item for key, item in value.items() if key != "snapshot_sha256"})


def _pin(monkeypatch, payload):
    monkeypatch.setattr(live, "APPROVED_EXPORT_SHA256", canonical_sha256({
        key: payload[key] for key in live._AUTHORIZATION_FIELDS}))


@pytest.fixture
def receipt(tmp_path, monkeypatch):
    payload = json.loads(COMMITTED_MANIFEST.read_text())
    proof = tmp_path / "approval.md"
    proof.write_text("Approved offline fixture, not database state")
    payload["approval"] = {"path": str(proof), "sha256": hashlib.sha256(proof.read_bytes()).hexdigest()}
    sql = tmp_path / "ingest.sql"
    sql.write_text("-- offline fixture only")
    payload["sql_path"] = str(sql)
    payload["sql_sha256"] = hashlib.sha256(sql.read_bytes()).hexdigest()
    history = {"artifacts": [], "questions": []}
    for index, artifact in enumerate(payload["artifacts"]):
        path = tmp_path / Path(artifact["path"]).name
        # Raw accepted flags are deliberately insufficient; replay is patched below.
        artifact.update(path=str(path), sha256=_write(path, {"accepted": True}))
        provenance = {
            "path": str(path), "sha256": artifact["sha256"],
            "policy": variant_history.HISTORY_POLICY, "note": variant_history.HISTORY_NOTE,
            "accepted_variant_ids": [], "judgments": [],
        }
        selected = [q for q in payload["questions"] if q["artifact"] == path.name]
        # Each artifact has one accepted but UNAPPROVED row, including round 2.
        questions = selected + [{"id": f"unapproved-{index}", "parent": "parent-other",
                                 "industry": "unapproved industry", "artifact": path.name}]
        for question in questions:
            ident = question["id"]
            provenance["accepted_variant_ids"].append(ident)
            provenance["judgments"].append({
                "candidate_id": ident, "request_path": str(tmp_path / "requests" / (ident + ".json")),
                "request_sha256": "1" * 64,
                "verdict_path": str(path.with_suffix(".verdicts") / (ident + ".json")),
                "verdict_sha256": "2" * 64, "accepted": True,
            })
            history["questions"].append({
                "id": ident, "stem": "Which service should the organization use?",
                "key": "Use the appropriate managed service.",
                "parent_question_id": question["parent"], "industry": question["industry"],
                "source_artifact_path": str(path), "source_artifact_sha256": artifact["sha256"],
            })
        history["artifacts"].append(provenance)
    _sign(history)
    variant_history.validate_prior_variants(history)
    _pin(monkeypatch, payload)
    manifest = tmp_path / "practice-ingest-13.json"
    _write(manifest, payload)
    calls = []

    def replay(paths):
        calls.append(list(paths))
        # Keep the genuine frozen-history validator in every selection test.
        variant_history.validate_prior_variants(history)
        return deepcopy(history)

    monkeypatch.setattr(variant_history, "load_prior_variants", replay)
    return manifest, payload, history, calls


def _load(receipt):
    path, payload, _, _ = receipt
    return live.load_live_priors(path, [Path(item["path"]) for item in payload["artifacts"]])


def test_committed_authorization_projection_is_pinned():
    payload = json.loads(COMMITTED_MANIFEST.read_text())
    live._manifest(payload, hashlib.sha256(COMMITTED_MANIFEST.read_bytes()).hexdigest())
    assert len(payload["questions"]) == 13
    assert [sum(q["artifact"] == Path(a["path"]).name for q in payload["questions"])
            for a in payload["artifacts"]] == [0, 6, 7]


def test_selects_exactly_13_and_preserves_original_frozen_proofs(receipt):
    path, payload, original, calls = receipt
    snapshot = _load(receipt)
    assert calls == [[Path(a["path"]) for a in payload["artifacts"]]]
    assert [row["id"] for row in snapshot["questions"]] == [q["id"] for q in payload["questions"]]
    assert len(snapshot["questions"]) == 13
    assert len(snapshot["history"]["questions"]) == 16
    assert snapshot["history"] == original
    assert snapshot["history"]["snapshot_sha256"] == original["snapshot_sha256"]
    assert snapshot["manifest"]["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert live.validate_live_priors(json.loads(json.dumps(snapshot))) == snapshot
    assert "not independent database LIVE" in snapshot["note"]
    snapshot["questions"][0]["stem"] += " changed"
    assert original["questions"][0]["stem"] != snapshot["questions"][0]["stem"]


def test_validation_is_read_free_and_root_dispatch_can_consume_rows(receipt, monkeypatch):
    snapshot = _load(receipt)
    monkeypatch.setattr(Path, "read_bytes", lambda *a: pytest.fail("Must not read sources"))
    monkeypatch.setattr(Path, "read_text", lambda *a: pytest.fail("Must not read sources"))
    assert live.validate_live_priors(snapshot) is snapshot
    # The root owns the small validate_prior_variants policy dispatch.
    assert variant_history.validate_prior_variants(snapshot) is snapshot


@pytest.mark.parametrize("defect", ["missing-r2", "repeat", "extra", "string", "relative"])
def test_requires_every_declared_artifact_exactly_once(receipt, defect):
    path, payload, _, calls = receipt
    paths = [Path(a["path"]) for a in payload["artifacts"]]
    if defect == "missing-r2":
        paths = paths[1:]
    elif defect == "repeat":
        paths.append(paths[0])
    elif defect == "extra":
        paths.append(path.parent / "extra.json")
    elif defect == "relative":
        paths[0] = Path(paths[0].name)
    else:
        paths = str(paths[0])
    with pytest.raises(ValueError):
        live.load_live_priors(path, paths)
    assert not calls


@pytest.mark.parametrize("field", ["id", "parent", "industry", "artifact", "approval", "sql", "artifact-hash"])
def test_manifest_authorization_cannot_be_replaced(receipt, field):
    path, payload, _, calls = receipt
    if field in {"id", "parent", "industry", "artifact"}:
        payload["questions"][0][field] = "forged"
    elif field == "approval":
        payload["approval"]["sha256"] = "0" * 64
    elif field == "sql":
        payload["sql_sha256"] = "0" * 64
    else:
        payload["artifacts"][0]["sha256"] = "0" * 64
    _write(path, payload)
    with pytest.raises(ValueError, match="committed approved export"):
        _load(receipt)
    assert not calls


def test_auxiliary_validation_metadata_may_change_without_changing_approval(receipt):
    path, payload, _, _ = receipt
    payload["pipeline_validation"] = {"notes": "additional offline evidence"}
    _write(path, payload)
    assert len(_load(receipt)["questions"]) == 13


@pytest.mark.parametrize("source", ["r2", "r3", "r4", "approval", "sql"])
@pytest.mark.parametrize("defect", ["changed", "missing", "symlink"])
def test_missing_or_changed_sources_block_before_replay(receipt, source, defect):
    path, payload, _, calls = receipt
    if source in {"r2", "r3", "r4"}:
        source_path = Path(payload["artifacts"][["r2", "r3", "r4"].index(source)]["path"])
    else:
        source_path = Path(payload["approval"]["path"] if source == "approval" else payload["sql_path"])
    if defect == "changed":
        source_path.write_text("tampered")
    elif defect == "missing":
        source_path.unlink()
    else:
        target = path.parent / "target"
        target.write_bytes(source_path.read_bytes())
        source_path.unlink()
        source_path.symlink_to(target)
    with pytest.raises(ValueError):
        _load(receipt)
    assert not calls


@pytest.mark.parametrize("defect", ["missing", "duplicate-id", "parent", "industry", "source", "hash", "missing-r2"])
def test_replay_binding_is_not_just_an_accepted_id_list(receipt, monkeypatch, defect):
    _, payload, history, _ = receipt
    row = next(row for row in history["questions"] if row["id"] == payload["questions"][0]["id"])
    if defect == "missing":
        history["questions"].remove(row)
        artifact = next(a for a in history["artifacts"] if a["path"] == row["source_artifact_path"])
        artifact["accepted_variant_ids"].remove(row["id"])
        next(j for j in artifact["judgments"] if j["candidate_id"] == row["id"])["accepted"] = False
    elif defect == "duplicate-id":
        duplicate = deepcopy(row)
        artifact = history["artifacts"][0]
        duplicate.update(source_artifact_path=artifact["path"], source_artifact_sha256=artifact["sha256"])
        history["questions"].append(duplicate)
        artifact["accepted_variant_ids"].append(row["id"])
        judgment = deepcopy(history["artifacts"][1]["judgments"][0])
        judgment["verdict_path"] = str(Path(artifact["path"]).with_suffix(".verdicts") / (row["id"] + ".json"))
        artifact["judgments"].append(judgment)
    elif defect in {"parent", "industry"}:
        row["parent_question_id" if defect == "parent" else "industry"] = "changed"
    elif defect == "source":
        row["source_artifact_path"] = history["artifacts"][0]["path"]
    elif defect == "hash":
        history["artifacts"][0]["sha256"] = "0" * 64
        for item in history["questions"]:
            if item["source_artifact_path"] == history["artifacts"][0]["path"]:
                item["source_artifact_sha256"] = "0" * 64
    else:
        removed = history["artifacts"].pop(0)
        history["questions"] = [r for r in history["questions"] if r["source_artifact_path"] != removed["path"]]
    _sign(history)
    with pytest.raises(ValueError):
        _load(receipt)


@pytest.mark.parametrize("defect", ["selected-stem", "drop-row", "add-row", "nested-judgment", "manifest", "policy"])
@pytest.mark.parametrize("resign", [False, True])
def test_frozen_tampering_is_rejected_even_after_outer_resign(receipt, defect, resign):
    snapshot = _load(receipt)
    if defect == "selected-stem":
        snapshot["questions"][0]["stem"] += " changed"
    elif defect == "drop-row":
        snapshot["questions"].pop()
    elif defect == "add-row":
        snapshot["questions"].append(snapshot["history"]["questions"][0])
    elif defect == "nested-judgment":
        snapshot["history"]["artifacts"][1]["judgments"][0]["accepted"] = False
        _sign(snapshot["history"])
    elif defect == "manifest":
        snapshot["manifest"]["payload"]["questions"][0]["parent"] = "forged"
    else:
        snapshot["policy"] = "forged"
    if resign:
        _sign(snapshot)
    with pytest.raises(ValueError):
        live.validate_live_priors(snapshot)


def test_source_changes_during_replay_are_rejected(receipt, monkeypatch):
    _, payload, history, _ = receipt

    def rewrite(paths):
        Path(payload["approval"]["path"]).write_text("changed during replay")
        return deepcopy(history)

    monkeypatch.setattr(variant_history, "load_prior_variants", rewrite)
    with pytest.raises(ValueError, match="changed during replay"):
        _load(receipt)


def test_raw_accepted_flags_are_not_a_fallback(receipt, monkeypatch):
    monkeypatch.undo()
    _, payload, _, _ = receipt
    _pin(monkeypatch, payload)
    with pytest.raises(ValueError, match="Unsupported historical variant policy"):
        _load(receipt)


def test_real_saved_verdict_failure_propagates_without_a_fallback(prior, receipt, monkeypatch):
    real_path, _, entry, verdicts = prior
    manifest, payload, _, _ = receipt
    (verdicts / (entry["candidate_id"] + ".json")).unlink()
    payload["artifacts"][0] = {"path": str(real_path), "sha256": hashlib.sha256(real_path.read_bytes()).hexdigest()}
    _write(manifest, payload)
    _pin(monkeypatch, payload)
    monkeypatch.setattr(variant_history, "load_prior_variants", variant_history._load_prior_variants)
    with pytest.raises(ValueError, match="regular, non-symlink"):
        _load(receipt)


def test_duplicate_manifest_json_keys_are_rejected(receipt):
    path, _, _, _ = receipt
    path.write_text('{"count":13,"count":13}')
    with pytest.raises(ValueError, match="Duplicate history JSON key"):
        _load(receipt)
