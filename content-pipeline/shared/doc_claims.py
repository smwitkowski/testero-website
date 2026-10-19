"""Plan-only clause queries. Extraction is syntactic, not a truth judgment."""
from __future__ import annotations
import re


def plan_claims(plan):
    """Keep every option/constraint clause, including scenario-only assumptions."""
    fields = [("A", "best_action", plan["best_action"], plan["best_action"])]
    fields += [("A", f"decisive_constraints.{i}", text, plan["best_action"])
               for i, text in enumerate(plan["decisive_constraints"])]
    for label, mistake in zip("BCD", plan["mistakes"]):
        fields += [(label, f"{label}.action", mistake["action"], mistake["action"]),
                   (label, f"{label}.scenario_reason", mistake["scenario_reason"], mistake["action"])]
    claims = []
    for label, field, text, action in fields:
        # Retain complete text as context: a split clause may omit its subject.
        clauses = re.split(r"(?<=[.!?;])\s+|\s+(?:but|whereas|although|because|while)\s+", text)
        for index, clause in enumerate(clauses):
            clause = clause.strip()
            if not clause:
                continue
            claims.append({"id": f"{field}:{index}", "option_label": label,
                           "field": field, "text": clause, "context": text, "action": action})
    return claims


def claim_queries(claim):
    """Clause-first query plus subject-bearing action, never an evidence quote."""
    queries = [claim["text"]]
    # Long reasons often mix a factual limitation and a scenario inference.
    # Clauses get independent turns rather than competing in one long query.
    parts = re.split(r",\s+(?:and|or)\s+|\s+(?:and|rather than|instead of)\s+", claim["text"])
    queries.extend(part.strip() for part in parts if len(part.split()) >= 3)
    queries.append(claim["action"] + " " + claim["text"])
    return list(dict.fromkeys(query for query in queries if query.strip()))
