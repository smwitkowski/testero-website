"""Typed nightly continuation proof. Unknown failures never permit more model calls."""
import json
from pathlib import Path


# Only local validation and bounded per-candidate transport failures are ordinary.
# Generic provider/CLI errors can hide quota/auth; they deliberately are not listed.
ORDINARY = {"CandidateRejected", "DecisionVetoError", "GenerationOutputError",
            "MaxTokensTruncation", "ReadTimeout", "TimeoutError", "ValidationError"}


def ordinary_failure(command):
    """Require structured records for every failed candidate, not error prose."""
    try:
        if "--artifact" in command and "generate_all_domains.py" in command[1]:
            artifact = Path(command[command.index("--artifact") + 1])
            if any(path.is_symlink() for path in (artifact, *artifact.parents)):
                return False
            payload = json.loads(artifact.read_text())
            if payload.get("batch_stop") or not isinstance(payload.get("candidates"), list):
                return False
            errors = [row for row in payload["candidates"]
                      if row.get("error_class") or row.get("failure_stage")
                      or (row.get("accepted") is False and not row.get("awaiting_external_judge"))]
            if any(row.get("failure_stage") == "persistence" for row in payload["candidates"]):
                return False  # Unknown DB outcome is never a partial quality failure.
        elif "--verdicts" in command and "judge_requests.py" in command[1]:
            root = Path(command[command.index("--verdicts") + 1]) / ".failures"
            paths = list(root.glob("*.json"))
            if root.is_symlink() or any(path.is_symlink() for path in paths):
                return False
            errors = [json.loads(path.read_text()) for path in paths]
        else:
            return False
        return bool(errors) and all(row.get("error_class") in ORDINARY for row in errors)
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        return False


def write_result(path, status):
    if path is None:
        return
    from scripts.pipeline_nightly import save
    save(path, {"schema": "nightly-stage-v1", "status": status})


class NightlyHardStop(ValueError):
    """Unknown, quota/auth, budget or persistence failure; no later paid stage."""
