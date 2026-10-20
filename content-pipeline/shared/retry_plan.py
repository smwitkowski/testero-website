"""Validated offline retry plans derived from one immutable full-plan artifact."""
import copy
import hashlib
import json
from pathlib import Path


def load_frozen_retry_plan(path, *, cert_id):
    """Derive replacement scopes from source slots, never caller-supplied scope text."""
    # Imported lazily: ingestion uses generator helpers, and this loader runs only
    # after both modules have finished loading.
    from scripts.ingest_external_verdicts import _read_json, _scope

    path = Path(path)
    if path.is_symlink():
        raise ValueError("Frozen retry plan cannot be a symlink")
    manifest = _read_json(path)
    keys = {"version", "cert_id", "source_artifact", "source_sha256", "full_plan_count", "slots"}
    if (not isinstance(manifest, dict) or set(manifest) != keys
            or type(manifest["version"]) is not int or manifest["version"] != 1
            or cert_id != "data-engineer" or manifest["cert_id"] != cert_id
            or not isinstance(manifest["source_artifact"], str)
            or not isinstance(manifest["source_sha256"], str)):
        raise ValueError("Invalid frozen retry plan provenance")
    source_path = Path(manifest["source_artifact"])
    if not source_path.is_absolute() or source_path.is_symlink():
        raise ValueError("Retry source must be an absolute regular artifact path")
    source_bytes = source_path.read_bytes()
    if hashlib.sha256(source_bytes).hexdigest() != manifest["source_sha256"]:
        raise ValueError("Frozen retry source changed")
    source = _read_json(source_path)
    count = manifest["full_plan_count"]
    if (type(count) is not int or count < 1 or not isinstance(source, dict)
            or source.get("cert_id") != cert_id or source.get("rules_version") != 5
            or source.get("judge_model") != "external"
            or not isinstance(source.get("plan"), list) or len(source["plan"]) != count
            or source.get("retry_slots") is not None
            or source.get("planned_count") != count):
        raise ValueError("Retry source is not an original full-plan artifact")
    slots = manifest["slots"]
    if not isinstance(slots, list) or not slots:
        raise ValueError("Frozen retry plan needs source slots")
    seen, scopes = set(), []
    for slot in slots:
        if (not isinstance(slot, dict) or set(slot) != {"plan_slot", "attempt"}
                or type(slot["plan_slot"]) is not int or not 1 <= slot["plan_slot"] <= count
                or slot["plan_slot"] in seen
                or type(slot["attempt"]) is not int or slot["attempt"] < 2):
            raise ValueError("Invalid or duplicate retry slot")
        seen.add(slot["plan_slot"])
        scope = source["plan"][slot["plan_slot"] - 1]
        if not isinstance(scope, dict):
            raise ValueError("Invalid retry source scope")
        _scope(source, {**scope, "index": slot["plan_slot"]})
        fresh = copy.deepcopy(scope)
        for field in ("decision_plan", "decision_proof", "decision_objective"):
            fresh.pop(field, None)
        scopes.append(fresh)
    return scopes, manifest
