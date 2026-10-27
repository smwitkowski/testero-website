"""Emit an opt-in plan pack from frozen cards, optionally extending a base pack.

No model, database, or search calls. Use the result with --prompt-pack and
--ab-interleaved to compare the base planner with and without the frozen cards.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from shared.prompt_pack import (create_pack, load_pack, pack_hash, save_pack, validate_pack)

CUTOFF = "2026-10-26T00:00:00Z"


def build_card_pack(cards, *, base_pack=None):
    """Copy a base plan pack, replace its lessons map, and bind card provenance."""
    from shared.decision_planner import DecisionPlanSignature
    from shared.planner_cards import lint_card_text
    if (not isinstance(cards, dict) or type(cards.get("version")) is not int
            or cards["version"] != 1 or cards.get("cutoff") != CUTOFF
            or not isinstance(cards.get("objectives"), dict) or not cards["objectives"]):
        raise ValueError("Expected frozen version-1 cards at the pre-experiment cutoff")
    lessons = {}
    for objective, record in cards["objectives"].items():
        if (not isinstance(objective, str)
                or not objective.startswith("machine-learning-engineer:")
                or not isinstance(record, dict)):
            raise ValueError("Only PMLE objective cards are allowed")
        text = record.get("text")
        lint_card_text(text)
        if record.get("sha256") != hashlib.sha256(text.encode("utf-8")).hexdigest():
            raise ValueError("Card text hash mismatch")
        for key, minimum in (("source_candidate_ids", 3), ("source_page_ids", 0)):
            ids = record.get(key)
            if (not isinstance(ids, list) or any(not isinstance(item, str) or not item.strip() for item in ids)
                    or len(set(ids)) != len(ids) or len(ids) < minimum):
                raise ValueError("Invalid card source provenance")
        lessons[objective] = text
    base = (create_pack(stage="plan", signature=DecisionPlanSignature,
        policy={"doccheck_policy": "v5"}, source_run="offline-card-base", scores={})
        if base_pack is None else validate_pack(base_pack))
    if base["stage"] != "plan":
        raise ValueError("Cards require a plan-stage base pack")
    result = deepcopy(base)
    if not result["writers"]:
        result["writers"] = create_pack(stage="plan", signature=DecisionPlanSignature,
            policy={}, source_run="offline-card-writer", scores={})["writers"]
    entry = next((row for row in result["writers"]
        if row["signature"] == DecisionPlanSignature.__name__), None)
    if entry is None:
        raise ValueError("Cards require the decision-plan writer")
    entry["lessons"] = lessons
    cards_hash = hashlib.sha256(json.dumps(cards, sort_keys=True, ensure_ascii=False,
        allow_nan=False, separators=(",", ":")).encode("utf-8")).hexdigest()
    result["policy"]["planner_cards"] = {"sha256": cards_hash, "cutoff": cards["cutoff"],
        "base_pack_sha256": pack_hash(base)}
    result["source_run"] = base["source_run"] + ":cards:" + cards_hash
    return validate_pack(result)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-pack", type=Path, help="Optional base plan pack; default unchanged v5")
    parser.add_argument("--cards", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    if args.output.exists():
        parser.error("Refusing to overwrite an existing prompt pack")
    from shared.cli_models import _load_json
    try:
        cards = _load_json(args.cards.read_text(encoding="utf-8"))
        value = build_card_pack(cards, base_pack=load_pack(args.base_pack) if args.base_pack else None)
        save_pack(value, args.output)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps({"status": "completed", "model_calls": 0, "output": str(args.output),
        "objectives": len(value["writers"][0]["lessons"]), "sha256": pack_hash(value)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
