"""Offline comparison priors selected by the fixed approved 13/15 exports.

This policy records the coordinator's publication receipt context, not an
independent observation of database LIVE state. It retains the complete frozen
historical replay and exposes only the approved rows for allocation and dedupe.
Hashes detect edits; they are not signatures or new publication approval.
"""
from copy import deepcopy
import hashlib
from pathlib import Path

LIVE_HISTORY_POLICY = "approved_practice_13_history_v1"
LIVE_HISTORY_NOTE = (
    "Comparison-only approved export snapshot; coordinator receipt context, not "
    "independent database LIVE verification or publication approval. Full original "
    "offline historical judgments are retained without changing their digest."
)
# This policy intentionally selects ONE committed approval, not arbitrary exports.
APPROVED_EXPORT_SHA256 = "128d57e24a3e777be7c23c962577d496a71addfbb26ca75fdca861b4822ed052"
CUMULATIVE_LIVE_HISTORY_POLICY = "approved_practice_15_history_v2"
CUMULATIVE_LIVE_HISTORY_NOTE = (
    "Comparison-only cumulative approved export snapshot: coordinator context is "
    "13 LIVE plus 2 approved offline, new SQL pending. Not independent database "
    "LIVE verification or publication approval. All original offline historical "
    "judgments, including unapproved backups, remain retained."
)
BASE_MANIFEST_PATH = str(Path(__file__).resolve().parents[1]
                         / "calibration/variants-2026-10-19/practice-ingest-13.json")
BASE_MANIFEST_SHA256 = "9fb8752b818d7ab491af468067b5d1e60ffeb7d26bd8f9d4c420c7e567deaea6"
BASE_MANIFEST_PAYLOAD_SHA256 = "67943af7e8fcba2754a85c4b69238994586a6b37b34e629f5e39a9edc19eb349"
# Fixed immutable coordinator-approved two-row receipt; never arbitrary exports.
APPROVED_ADDITION_EXPORT_SHA256 = "f06feb1114965d6e739e81642d9eac93cb849c01d8f71c25c4accd12ce883e82"
ADDITION_MANIFEST_SHA256 = "d0e346aa1785913b3f6b0ec31e5169718034230f35273edfaa25223a15485d59"
ADDITION_MANIFEST_PAYLOAD_SHA256 = "cc9892830d7c92bb60dcdfe8c2c82f4c82077fc79f5bcd29a8823929de978d03"
ADDITION_APPROVAL_SHA256 = "2ab2f0f82534643ab8549baeb0a2fb7524c8f5c2946b138e133d3e7f8a0b4d82"
_ADDITION_QUESTIONS = (
    {"id": "d4b10e1f-bfe3-51d6-b74b-4481d2207d19",
     "parent": "a31d11b8-8dd5-55ed-9ba4-a4b4e8400bcf",
     "industry": "hospital operations", "artifact": "repair-r5-live.json"},
    {"id": "5fe281b2-b348-5829-ad5a-80de90cd4235",
     "parent": "57b9d0c7-8d93-5858-a699-4fc0afeae507",
     "industry": "public transit", "artifact": "repair-r5-live.json"},
)

_AUTHORIZATION_FIELDS = ("approval", "sql_path", "sql_sha256", "artifacts", "count", "questions")


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _absolute(value):
    return (isinstance(value, str) and bool(value.strip())
            and Path(value).is_absolute() and ".." not in Path(value).parts)


def _file_hash(path):
    _require(path.is_file() and not path.is_symlink(),
             f"Live-prior evidence must be a regular, non-symlink file: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _manifest(payload, raw_digest):
    from shared.external_judge import canonical_sha256

    import re

    _require(isinstance(payload, dict) and isinstance(raw_digest, str)
             and re.fullmatch(r"[0-9a-f]{64}", raw_digest) is not None
             and canonical_sha256({key: payload[key] for key in _AUTHORIZATION_FIELDS})
             == APPROVED_EXPORT_SHA256,
             "Live-prior manifest differs from the committed approved export")
    _require(type(payload["count"]) is int and payload["count"] == 13
             and len(payload["questions"]) == 13 and len(payload["artifacts"]) == 3,
             "Live-prior manifest must declare exactly 13 questions and three artifacts")
    artifacts = {}
    for artifact in payload["artifacts"]:
        path = artifact["path"]
        _require(_absolute(path) and Path(path).suffix == ".json"
                 and Path(path).name not in artifacts,
                 "Duplicate or invalid declared live-prior artifact")
        artifacts[Path(path).name] = artifact
    ids = set()
    for question in payload["questions"]:
        _require(isinstance(question, dict)
                 and set(question) == {"id", "parent", "industry", "artifact"}
                 and all(isinstance(value, str) and value.strip() for value in question.values())
                 and question["id"] not in ids and question["artifact"] in artifacts,
                 "Duplicate or invalid approved live-prior question")
        ids.add(question["id"])
    return artifacts


def _receipt_envelope(receipt, expected_path):
    import re

    _require(isinstance(receipt, dict) and set(receipt) == {"path", "sha256", "payload"}
             and _absolute(receipt["path"]) and receipt["path"] == expected_path
             and isinstance(receipt["sha256"], str)
             and re.fullmatch(r"[0-9a-f]{64}", receipt["sha256"]) is not None
             and isinstance(receipt["payload"], dict),
             "Invalid cumulative receipt path/raw hash/payload binding")


def _cumulative_manifest(payload, raw_digest):
    """Check the two fixed authorizations; never authorize arbitrary exports."""
    from shared.external_judge import canonical_sha256
    import re

    _require(isinstance(payload, dict) and set(payload) == {
        "policy", "base", "addition", "count", "artifacts", "questions"}
        and payload["policy"] == CUMULATIVE_LIVE_HISTORY_POLICY
        and isinstance(raw_digest, str) and re.fullmatch(r"[0-9a-f]{64}", raw_digest) is not None,
        "Invalid cumulative live-prior manifest")
    _receipt_envelope(payload["base"], BASE_MANIFEST_PATH)
    _receipt_envelope(payload["addition"], str(Path(BASE_MANIFEST_PATH).with_name("practice-ingest-r5-2.json")))
    base, addition = payload["base"]["payload"], payload["addition"]["payload"]
    _manifest(base, payload["base"]["sha256"])
    _require(payload["base"]["sha256"] == BASE_MANIFEST_SHA256
             and canonical_sha256(base) == BASE_MANIFEST_PAYLOAD_SHA256,
             "Cumulative live priors require the byte-exact original 13 receipt")
    _require(canonical_sha256({key: addition[key] for key in _AUTHORIZATION_FIELDS})
             == APPROVED_ADDITION_EXPORT_SHA256,
             "Cumulative live-prior addition differs from the committed approved export")
    _require(type(addition["count"]) is int and addition["count"] == 2
             and addition["questions"] == list(_ADDITION_QUESTIONS)
             and addition["approval"]["sha256"] == ADDITION_APPROVAL_SHA256
             and len(addition["artifacts"]) == 1
             and set(addition["artifacts"][0]) == {"path", "sha256"}
             and _absolute(addition["artifacts"][0]["path"])
             and Path(addition["artifacts"][0]["path"]).name == "repair-r5-live.json",
             "Cumulative live priors require exactly the two approved round-5 winners")
    _require(type(payload["count"]) is int and payload["count"] == 15
             and payload["artifacts"] == base["artifacts"] + addition["artifacts"]
             and payload["questions"] == base["questions"] + addition["questions"]
             and len({a["path"] for a in payload["artifacts"]}) == 4
             and len({Path(a["path"]).name for a in payload["artifacts"]}) == 4
             and len({q["id"] for q in payload["questions"]}) == 15,
             "Cumulative live priors require the exact 13-plus-2 union")
    for receipt in (base, addition):
        _require(set(receipt["approval"]) == {"path", "sha256"}
                 and _absolute(receipt["approval"]["path"]) and _absolute(receipt["sql_path"])
                 and Path(receipt["sql_path"]).suffix == ".sql",
                 "Invalid cumulative approval/SQL provenance")
        for digest in [receipt["approval"]["sha256"], receipt["sql_sha256"],
                       *[a["sha256"] for a in receipt["artifacts"]]]:
            _require(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest) is not None,
                     "Invalid cumulative evidence hash")
    _require(payload["addition"]["sha256"] == ADDITION_MANIFEST_SHA256
             and canonical_sha256(addition) == ADDITION_MANIFEST_PAYLOAD_SHA256,
             "Cumulative live priors require the byte-exact approved two-row receipt")
    return {Path(a["path"]).name: a for a in payload["artifacts"]}


def _manifest_policy(payload, raw_digest):
    if isinstance(payload, dict) and payload.get("policy") == CUMULATIVE_LIVE_HISTORY_POLICY:
        _cumulative_manifest(payload, raw_digest)
        return CUMULATIVE_LIVE_HISTORY_POLICY, CUMULATIVE_LIVE_HISTORY_NOTE
    _manifest(payload, raw_digest)
    return LIVE_HISTORY_POLICY, LIVE_HISTORY_NOTE


def _select(payload, original):
    from shared.variant_history import _validate_prior_variants

    # Deliberately validate the original legacy policy, not the dispatch wrapper.
    _validate_prior_variants(original)
    declared = {item["path"]: item["sha256"] for item in payload["artifacts"]}
    actual = {item["path"]: item["sha256"] for item in original["artifacts"]}
    _require(actual == declared, "Live-prior replay must include every declared artifact and hash")
    selected = []
    for question in payload["questions"]:
        matches = [row for row in original["questions"] if row["id"] == question["id"]]
        _require(len(matches) == 1, "Approved live-prior ID must resolve uniquely in accepted replay")
        row = matches[0]
        artifact = next(item for item in payload["artifacts"]
                        if Path(item["path"]).name == question["artifact"])
        _require(row["source_artifact_path"] == artifact["path"]
                 and row["source_artifact_sha256"] == artifact["sha256"]
                 and row["parent_question_id"] == question["parent"]
                 and row["industry"] == question["industry"],
                 "Approved live-prior parent/industry/artifact binding mismatch")
        selected.append(deepcopy(row))
    return selected


def _validate_live_priors(snapshot):
    from shared.external_judge import canonical_sha256

    _require(isinstance(snapshot, dict) and set(snapshot) == {
        "policy", "note", "manifest", "history", "questions", "snapshot_sha256"},
        "Invalid approved live-prior snapshot structure")
    _require((snapshot["policy"], snapshot["note"]) in (
        (LIVE_HISTORY_POLICY, LIVE_HISTORY_NOTE),
        (CUMULATIVE_LIVE_HISTORY_POLICY, CUMULATIVE_LIVE_HISTORY_NOTE)),
        "Unsupported approved live-prior policy")
    _require(snapshot["snapshot_sha256"] == canonical_sha256({
        key: value for key, value in snapshot.items() if key != "snapshot_sha256"}),
        "Approved live-prior snapshot hash mismatch")
    manifest = snapshot["manifest"]
    _require(isinstance(manifest, dict) and set(manifest) == {"path", "sha256", "payload"}
             and _absolute(manifest["path"]) and Path(manifest["path"]).suffix == ".json",
             "Invalid frozen live-prior manifest provenance")
    policy, note = _manifest_policy(manifest["payload"], manifest["sha256"])
    _require(snapshot["policy"] == policy and snapshot["note"] == note,
             "Snapshot and manifest live-prior policies differ")
    if policy == CUMULATIVE_LIVE_HISTORY_POLICY:
        _require(manifest["path"] == str(Path(BASE_MANIFEST_PATH).with_name("practice-ingest-15.json")),
                 "Invalid cumulative live-prior manifest path")
    _require(snapshot["questions"] == _select(manifest["payload"], snapshot["history"]),
             "Approved live-prior selected rows differ from bound historical evidence")
    return snapshot


def validate_live_priors(snapshot):
    """Validate both policies and selection without reading files or querying DB.

    The caller can dispatch this distinct policy from ``validate_prior_variants``.
    Raises ValueError for malformed or inconsistent frozen evidence.
    """
    try:
        return _validate_live_priors(snapshot)
    except (KeyError, TypeError, UnicodeError, StopIteration) as error:
        raise ValueError(f"Invalid approved live-prior evidence ({type(error).__name__})") from error


def _load_live_priors(manifest_path, artifact_paths):
    from shared.external_judge import canonical_sha256
    from shared.variant_history import _read, load_prior_variants

    # Normalize the CLI boundary without resolving away a manifest symlink.
    path = Path(manifest_path).absolute()
    _require(_absolute(str(path)) and path.suffix == ".json",
             "Live-prior manifest requires an absolute JSON path")
    payload, digest = _read(path)
    policy, note = _manifest_policy(payload, digest)
    if policy == CUMULATIVE_LIVE_HISTORY_POLICY:
        _require(str(path) == str(Path(BASE_MANIFEST_PATH).with_name("practice-ingest-15.json")),
                 "Invalid cumulative live-prior manifest path")
    _require(not isinstance(artifact_paths, (str, Path)),
             "Live-prior artifact paths must be an iterable of absolute paths")
    paths = [Path(item) for item in artifact_paths]
    names = [str(item) for item in paths]
    declared = {item["path"]: item["sha256"] for item in payload["artifacts"]}
    _require(len(names) == len(set(names)) and set(names) == set(declared),
             "Live priors require all declared artifacts exactly once")
    # Approval and generated SQL are offline publication evidence, not DB proof.
    proof_files = {path: digest, **{Path(name): value for name, value in declared.items()}}
    receipts = [payload] if policy == LIVE_HISTORY_POLICY else [
        payload["base"]["payload"], payload["addition"]["payload"]]
    if policy == CUMULATIVE_LIVE_HISTORY_POLICY:
        for name in ("base", "addition"):
            frozen = payload[name]
            actual_payload, actual_digest = _read(Path(frozen["path"]))
            _require(actual_digest == frozen["sha256"] and actual_payload == frozen["payload"],
                     "Cumulative source receipt payload/raw hash mismatch")
            proof_files[Path(frozen["path"])] = frozen["sha256"]
    for receipt in receipts:
        proof_files[Path(receipt["approval"]["path"])] = receipt["approval"]["sha256"]
        proof_files[Path(receipt["sql_path"])] = receipt["sql_sha256"]
    for file, expected in proof_files.items():
        _require(_file_hash(file) == expected, "Live-prior source/approval/SQL hash mismatch")
    original = load_prior_variants(paths)
    selected = _select(payload, original)
    for file, expected in proof_files.items():
        _require(_file_hash(file) == expected, "Live-prior evidence changed during replay")
    snapshot = {
        "policy": policy, "note": note,
        "manifest": {"path": str(path), "sha256": digest, "payload": payload},
        "history": original, "questions": selected,
    }
    snapshot["snapshot_sha256"] = canonical_sha256(snapshot)
    validate_live_priors(snapshot)
    return deepcopy(snapshot)


def load_live_priors(manifest_path, artifact_paths):
    """Replay every declared artifact and select the fixed 13 or 15 approved priors.

    The manifest path may be relative; frozen paths remain absolute. Artifact
    paths must match the committed manifest. No models, database calls, or writes
    occur. Missing, changed, ambiguous, or rejected evidence raises ValueError.
    """
    try:
        return _load_live_priors(manifest_path, artifact_paths)
    except (KeyError, TypeError, OSError, UnicodeError, StopIteration) as error:
        raise ValueError(f"Invalid approved live-prior evidence ({type(error).__name__}): {error}") from error
