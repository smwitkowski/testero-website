"""Offline comparison priors selected by the approved 13-question export.

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
    _require(snapshot["policy"] == LIVE_HISTORY_POLICY and snapshot["note"] == LIVE_HISTORY_NOTE,
             "Unsupported approved live-prior policy")
    _require(snapshot["snapshot_sha256"] == canonical_sha256({
        key: value for key, value in snapshot.items() if key != "snapshot_sha256"}),
        "Approved live-prior snapshot hash mismatch")
    manifest = snapshot["manifest"]
    _require(isinstance(manifest, dict) and set(manifest) == {"path", "sha256", "payload"}
             and _absolute(manifest["path"]) and Path(manifest["path"]).suffix == ".json",
             "Invalid frozen live-prior manifest provenance")
    _manifest(manifest["payload"], manifest["sha256"])
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

    path = Path(manifest_path)
    _require(_absolute(str(path)) and path.suffix == ".json",
             "Live-prior manifest requires an absolute JSON path")
    payload, digest = _read(path)
    _manifest(payload, digest)
    _require(not isinstance(artifact_paths, (str, Path)),
             "Live-prior artifact paths must be an iterable of absolute paths")
    paths = [Path(item) for item in artifact_paths]
    names = [str(item) for item in paths]
    declared = {item["path"]: item["sha256"] for item in payload["artifacts"]}
    _require(len(names) == len(set(names)) and set(names) == set(declared),
             "Live priors require all three declared artifacts exactly once")
    # Approval and generated SQL are offline publication evidence, not DB proof.
    proof_files = {path: digest,
                   Path(payload["approval"]["path"]): payload["approval"]["sha256"],
                   Path(payload["sql_path"]): payload["sql_sha256"],
                   **{Path(name): value for name, value in declared.items()}}
    for file, expected in proof_files.items():
        _require(_file_hash(file) == expected, "Live-prior source/approval/SQL hash mismatch")
    original = load_prior_variants(paths)
    selected = _select(payload, original)
    for file, expected in proof_files.items():
        _require(_file_hash(file) == expected, "Live-prior evidence changed during replay")
    snapshot = {
        "policy": LIVE_HISTORY_POLICY, "note": LIVE_HISTORY_NOTE,
        "manifest": {"path": str(path), "sha256": digest, "payload": payload},
        "history": original, "questions": selected,
    }
    snapshot["snapshot_sha256"] = canonical_sha256(snapshot)
    validate_live_priors(snapshot)
    return deepcopy(snapshot)


def load_live_priors(manifest_path, artifact_paths):
    """Replay all three saved artifacts and select exactly 13 approved priors.

    Paths must match the committed manifest. No models, database calls, or writes
    occur. Missing, changed, ambiguous, or rejected evidence raises ValueError.
    """
    try:
        return _load_live_priors(manifest_path, artifact_paths)
    except (KeyError, TypeError, OSError, UnicodeError, StopIteration) as error:
        raise ValueError(f"Invalid approved live-prior evidence ({type(error).__name__}): {error}") from error
