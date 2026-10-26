"""Configuration-bound council health. No model or database calls."""
from copy import deepcopy
import json
from pathlib import Path

from shared.argon_gate import MODEL, model_for_transport, transport_for_model

DEFAULT_STATE = Path(__file__).resolve().parents[3] / "hq/tools/council-health.json"
DEFAULT_PAUSE = DEFAULT_STATE.with_name("PIPELINE_PAUSED")
DEFECTS = ("swapped_key", "retired_name")


def empty_health():
    return {"version": 1, "windows": {d: [] for d in DEFECTS}, "gold": [], "seen": []}


def migrate_state(saved):
    """Legacy health proves only the original Argon configuration, never Codex."""
    if not isinstance(saved, dict):
        raise ValueError("Invalid rolling health state")
    if saved.get("version") == 1:
        saved = {"version": 2, "configurations": {MODEL: deepcopy(saved)}}
    if saved.get("version") != 2 or not isinstance(saved.get("configurations"), dict):
        raise ValueError("Invalid rolling health state")
    for model, health in saved["configurations"].items():
        transport_for_model(model)
        if (not isinstance(health, dict) or health.get("version") != 1
                or set(health.get("windows", {})) != set(DEFECTS)
                or any(not isinstance(rows, list) for rows in health["windows"].values())
                or not isinstance(health.get("gold"), list)
                or not isinstance(health.get("seen"), list)):
            raise ValueError("Invalid configuration health state")
    return saved


def pause_path(pause, second_seat_transport="openrouter"):
    model = model_for_transport(second_seat_transport)
    pause = Path(pause)
    if second_seat_transport == "openrouter":
        return pause
    return pause.with_name(pause.name + "." + model.replace("/", "-"))


def _read(path):
    # Import lazily to share strict JSON and symlink checks with health CLI.
    from scripts.council_health import read_json, no_symlinks
    return read_json(no_symlinks(path))


def is_paused(*, pause=DEFAULT_PAUSE, second_seat_transport="openrouter"):
    """Manual base sentinel stops all; health JSON stops only its configuration."""
    model = model_for_transport(second_seat_transport)
    base = Path(pause)
    # A broken symlink or malformed scoped sentinel must fail closed.
    scoped = base.with_name(base.name + "." + model.replace("/", "-"))
    if scoped.exists() or scoped.is_symlink():
        return True
    if not base.exists() and not base.is_symlink():
        return False
    try:
        record = _read(base)
    except (OSError, ValueError, TypeError):
        return True
    if not isinstance(record, dict) or not {"at", "reasons"} <= set(record):
        return True
    declared = record.get("model", MODEL)
    transport_for_model(declared)
    return declared == model


def readiness_errors(*, state=DEFAULT_STATE, pause=DEFAULT_PAUSE,
                     second_seat_transport="openrouter"):
    """Require Codex's own complete canary and gold receipts before publication."""
    model = model_for_transport(second_seat_transport)
    errors = ["council_configuration_paused"] if is_paused(
        pause=pause, second_seat_transport=second_seat_transport) else []
    if second_seat_transport == "openrouter":
        return errors
    if not Path(state).exists():
        return errors + ["council_configuration_not_ready"]
    saved = migrate_state(_read(state))
    health = saved["configurations"].get(model, {})
    bootstrap = health.get("bootstrap", {})
    canary, gold = bootstrap.get("canaries", {}), bootstrap.get("gold", {})
    def count_at_least(value, minimum):
        return type(value) is int and value >= minimum

    def rate_at_least(value, minimum):
        return type(value) in (int, float) and minimum <= value <= 1

    if (canary.get("complete") is not True or canary.get("model") != model
            or any(not count_at_least(canary.get("canaries", {}).get(d, {}).get("count"), 20)
                   or not rate_at_least(canary.get("canaries", {}).get(d, {}).get("catch_rate"), 1)
                   for d in DEFECTS)
            or gold.get("complete") is not True or gold.get("model") != model
            or not count_at_least(gold.get("gold", {}).get("count"), 1)
            or not rate_at_least(gold.get("gold", {}).get("pass_rate"), .8)):
        errors.append("council_configuration_not_ready")
    return errors


def require_ready(*, state=DEFAULT_STATE, pause=DEFAULT_PAUSE,
                  second_seat_transport="openrouter"):
    if readiness_errors(state=state, pause=pause,
                        second_seat_transport=second_seat_transport):
        raise ValueError("Council configuration is paused or not ready")
