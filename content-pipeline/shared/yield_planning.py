"""Bounded planning history and same-section admission rotation; no quality gates."""
from collections import Counter
import math

from shared.near_duplicates import comparison_row, tokens

MAX_SCENARIOS = 12
SUMMARY_CHARS = 240


def existing_scenarios(scope, bank, candidates, planned=()):
    """Prefer batch history and exact mappings; unmapped exports are relevance hints."""
    objective = scope["objective_id"]
    rows = []
    for entry in candidates:
        if entry["objective_id"] == objective and entry.get("options") and entry.get("stem"):
            rows.append(comparison_row(entry))
    for entry in planned:
        if entry["objective_id"] == objective:
            rows.append({"stem": entry["existing_system"], "key": entry["best_action"]})
    exact = [row for row in bank if row.get("objective_id") == objective]
    vocabulary = tokens(scope["objective_context"] + " " + " ".join(scope["services"]))
    unmapped = [row for row in bank if not row.get("objective_id")]
    unmapped = [row for row in unmapped if vocabulary & tokens(row["stem"] + " " + row["key"])]
    unmapped.sort(key=lambda row: len(vocabulary & tokens(row["stem"] + " " + row["key"])), reverse=True)
    selected = []
    seen = set()
    for row in [*reversed(rows), *exact, *unmapped]:
        summary = {"stem_summary": " ".join(row["stem"].split())[:SUMMARY_CHARS],
                   "keyed_action": " ".join(row["key"].split())[:SUMMARY_CHARS],
                   "attribution": "unmapped_export_hint" if row in unmapped else "selected_objective"}
        pair = (summary["stem_summary"], summary["keyed_action"])
        if pair not in seen:
            selected.append(summary)
            seen.add(pair)
        if len(selected) == MAX_SCENARIOS:
            break
    return selected


class ObjectiveRotation:
    """Reserve admissions; failed alternatives are eligible below fair share unless exhausted."""
    def __init__(self, plan, pools):
        self.pools = pools
        self.admitted = Counter()
        self.section_slots = Counter(item["domain_code"] for item in plan)

    def select(self, scope, candidates):
        pool = self.pools[scope["domain_code"]]
        fair_share = math.ceil(self.section_slots[scope["domain_code"]] / len(pool))
        failed = {row["objective_id"] for row in candidates
                  if row.get("failure_stage") in ("decision_veto", "near_duplicate", "near_duplicate_plan")}
        successes = Counter(row["objective_id"] for row in candidates
                            if row.get("accepted") is True or row.get("awaiting_external_judge") is True)
        original = scope["objective_id"]
        selected = original
        if original in failed:
            eligible = [ident for ident in pool if ident != original
                        and (ident not in failed or self.admitted[ident] < fair_share)]
            # If every objective is exhausted, spread unavoidable remaining slots.
            selected = min(eligible or pool, key=lambda ident: (successes[ident], self.admitted[ident], pool.index(ident)))
        self.admitted[selected] += 1
        return selected, fair_share
