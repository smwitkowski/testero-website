# Next decision-first PMLE batch — coverage input blocked

Prepared 2026-10-13. **Do not run generation until the founder supplies and approves a fresh, verified ACTIVE objective mapping.** No live calls or DB writes were made for this runbook. D-029 supersedes pilot section quotas: target the fewest ACTIVE questions, not weighted sections.

## Evidence and freshness

Only the local bank snapshot exported **2026-10-04** was found. Its 145 ACTIVE rows have no grounding objective receipts; the audit maps them lexically and explicitly calls coverage provisional. Those counts are not verified objective coverage. The accepted pilot artifact has 12 exact objective mappings; D-029 records founder approval and ACTIVE promotion on 2026-10-13, with 157 total ACTIVE. The artifact itself records persistence, not a fresh ACTIVE-state export. No authoritative post-promotion objective export was available locally.

Current standard guide as-of date: 2026-06-01; normalized guide SHA-256: `bee925a0fb365488f57fee26b1fca8cdfc82e67fdb8753afb0472c2d3b257701`. Local exact-byte SHA-256 evidence:

- `content-pipeline/.cache/bank/pmle-bank-2026-10-04.json`: `7e2899dd67735ef73881ae41f400b98e14babe126012cf8cd587b84d2b6d3001`
- `content-pipeline/.cache/bank/pmle-bank-2026-10-04-audit.json`: `b2cc5515356c421a665ba4fb71e4dabe24be7f4aef499ec59cb567402013dc31`
- `content-pipeline/.cache/generation/pmle-d025-v4-pilot-30b.json`: `10c49d1137f7bcbab9f97ca02d9437d9948e6a185eb5ea89fd4564543a08928e`
- `content-pipeline/certs/machine-learning-engineer.json`: `7d5c50135ae3ae8816f10362a30397cab0be7697c678a714b20954ab5387ac6f`

Context only: adding the 12 accepted pilot mappings to the old lexical estimates reduces 15 proxy-zero objectives to 10: `1.1:5`, `1.2:1`, `1.2:2`, `1.2:3`, `2.1:3`, `2.2:3`, `3.2:6`, `3.3:1`, `4.1:4`, `4.1:5`. Three cycles would produce 30 candidates. **This is an estimate, not the required generation input.** It assumes no other activation, retirement or correction since October 4 and does not repair legacy mapping ambiguity.

## Founder coverage prerequisite

The checked schema stores `review_notes` as TEXT, not a mandatory objective column. New receipts contain `grounding.objective_id`; the legacy export has no such receipts. An aggregate SQL query cannot truthfully assign all legacy rows to current objectives. No misleading objective-count SQL is supplied.

Founder: obtain a fresh read-only ACTIVE PMLE export through your approved access, verify each row's current-guide objective (manually map legacy rows and review ambiguous/multiple-objective assignments), and produce the following aggregate-only local input. Count distinct question IDs per assigned objective. Include every one of the 52 current objectives, including zero; allow multiple assignments only when individually reviewed and document that policy. Do not place learner PII or credentials in this file. Resolve all unmapped ACTIVE questions before selection; reconcile distinct ACTIVE total with the fresh bank snapshot (157 is historical D-029 context, not a hardcoded current total).

Save `.cache/bank/pmle-active-objectives-2026-10-13-verified.json`:

```json
{
  "cert_id": "machine-learning-engineer",
  "guide_sha256": "bee925a0fb365488f57fee26b1fca8cdfc82e67fdb8753afb0472c2d3b257701",
  "snapshot_at": "REPLACE_WITH_REAL_UTC_SNAPSHOT_TIMESTAMP",
  "mapping_verified": true,
  "unmapped_active_questions": 0,
  "mapping_evidence": "REPLACE_WITH_EXPORT_SHA256_AND_REVIEWED_MAPPING_PROVENANCE",
  "objectives": [
    {"objective_id": "machine-learning-engineer:standard:1.1:1", "active_count": 0}
  ]
}
```

This is a format example, not count evidence; replace the example with all 52 actual rows. The founder must confirm freshness and mappings before setting `mapping_verified: true`. If the bank changes before generation, refresh and reselect.

## Deterministic selection and exact 30-item plan

Choose the minimum verified ACTIVE-count tier, retain **all ties** ordered by exact objective ID, and use the first 30 only if the tier exceeds 30. Cycle selected IDs in that order to 30. With K ≤30 selected objectives, each gets floor(30/K), with the first 30 mod K receiving one extra. This prioritizes the absolute lowest tier; it does not assume candidates become ACTIVE. Ties are lexical ID order, not exam weight or random offset. The CLI de-duplicates repeated flags, then cycles them; supply each selected ID once. Inspect the printed expanded plan and obtain founder approval before any live generation.

From `content-pipeline/`, run this local-only selection through the package environment. It prints flags to stdout and snapshot/hash/selection evidence to stderr. No model, network or DB calls:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -c 'import datetime, hashlib, json, pathlib, shlex
p = pathlib.Path(".cache/bank/pmle-active-objectives-2026-10-13-verified.json")
data = json.loads(p.read_text())
registry = json.loads(pathlib.Path("certs/machine-learning-engineer.json").read_text())
guide = next(g for g in registry["guides"] if g["variant"] == "standard")
ids = {o["id"] for s in guide["sections"] if s["included"] for sub in s["subsections"] for o in sub["objectives"]}
assert data["cert_id"] == "machine-learning-engineer"
assert data["guide_sha256"] == guide["normalized_text_sha256"]
assert data["mapping_verified"] is True
assert data["unmapped_active_questions"] == 0
stamp = datetime.datetime.fromisoformat(data["snapshot_at"].replace("Z", "+00:00"))
assert stamp.tzinfo is not None
rows = data["objectives"]
assert len(rows) == len(ids) == 52
assert {r["objective_id"] for r in rows} == ids
assert all(type(r["active_count"]) is int and r["active_count"] >= 0 for r in rows)
assert data["mapping_evidence"]
lowest = min(r["active_count"] for r in rows)
tied = sorted(r["objective_id"] for r in rows if r["active_count"] == lowest)
selected = tied[:30]
expanded = [selected[i % len(selected)] for i in range(30)]
# CLI de-duplicates flags and cycles selected IDs; this expansion shows its exact plan.
print(" ".join("--objective " + shlex.quote(i) for i in selected))
report = {"snapshot_at": data["snapshot_at"], "input_sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "minimum_active_count": lowest, "tied_objectives": tied, "selected_objectives": selected, "expanded_30": expanded}
print(json.dumps(report, indent=2), file=__import__("sys").stderr)' > .cache/bank/pmle-next-30-objectives.flags
```

## Separately authorized operator commands

These are instructions only, not authorization. Do not run them here. Use shell-provided Exa access and existing Codex/Claude logins; never read `.env*`. Wait for each phase to finish and inspect any nonzero exit before continuing. Use **Bash** for the array syntax below. Start from `content-pipeline/`. Fixed fresh paths below were absent when prepared; if any exists, stop and agree a new name for all paths. Never copy an artifact to bypass journals.

```sh
set -e
A=.cache/generation/pmle-d029-v4-next-30-20261013a.json
R=.cache/generation/pmle-d029-v4-next-30-20261013a.judge-requests
V=.cache/generation/pmle-d029-v4-next-30-20261013a.verdicts
# Bash array: flags file contains only validated IDs and --objective tokens.
read -r -a OBJECTIVES < .cache/bank/pmle-next-30-objectives.flags
test "${#OBJECTIVES[@]}" -ge 2  # Empty targets must never fall back to section weights.

test ! -e "$A" && test ! -e "$R" && test ! -e "$V" || exit 1
PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 30 "${OBJECTIVES[@]}" \
  --model codex --judge-model external --parallel 3 \
  --gen-effort high --cite-effort medium --artifact "$A"

PYTHON_DOTENV_DISABLED=1 uv run python scripts/judge_requests.py \
  --requests "$R" --verdicts "$V" --judge-model claude --parallel 3

# Inventory only; inspect supported failures before authorizing repair.
PYTHON_DOTENV_DISABLED=1 uv run python scripts/repair_candidates.py \
  --artifact "$A" --verdicts "$V" --dry-run

# Separately approved one-attempt repairs only; journals consume failed/unknown attempts.
PYTHON_DOTENV_DISABLED=1 uv run python scripts/repair_candidates.py \
  --artifact "$A" --verdicts "$V" --parallel 3 \
  --gen-effort high --cite-effort medium

# Existing verdicts are skipped; fresh repairs require all three gates.
PYTHON_DOTENV_DISABLED=1 uv run python scripts/judge_requests.py \
  --requests "$R" --verdicts "$V" --judge-model claude --parallel 3

PYTHON_DOTENV_DISABLED=1 uv run python scripts/ingest_external_verdicts.py \
  --artifact "$A" --verdicts "$V" --dry-run
```

Decision-first rules v4 are the generator's current path; there is no separate mode flag. Use docs as a veto, not topic seeds. Each schema/mechanical-PASS candidate requires blind solver, style critic and evidence reviewer PASS under the exact frozen schemas. Missing, malformed, false or uncertain results fail closed; do not average gates or reuse historical single-judge approvals. Repairs preserve key/evidence/objective/lineage and get three fresh gates; no weakened factual checks or retrying consumed attempts.

Inspect actual objective coverage, receipts/hashes, lineage, journals, all-gate yield, option-prefix and key-length reports. Dry ingestion constructs no DB client. Any DRAFT/GOOD write is a separate approved operation; founder review of the unchanged eligible pool is still required before ACTIVE. No generation, model gate, repair or dry run publishes or retires questions. D-025 retirement requires separately approved domain replacement counts.
