# PDE answer-pattern replay (offline)

## Result

All three saved repeats are vetoed at the decision-plan and written-option
stages against the complete saved authored pilot set plus the saved bank.
The two saved distinct controls pass: opposite CMEK key-version goals and a
different on-demand cost-control mechanism.

| Saved repeat | Expected pilot comparison | Result |
|---|---|---|
| Nested ARRAY of STRUCT children | `1d68939c-1da3-5c5f-bf79-8979e9b36389` | Veto |
| Row-multiplying join rewrite | `56e07b92-384b-53c5-a0a1-87b64fc69283` | Veto |
| Separate workload baseline reservation | `2d41c9fa-dadd-5596-b567-ad8a6a0c346d` | Veto |

The comparison set contains all 21 complete authored pilot questions and the
14-question saved ACTIVE/DRAFT export: 22 unique questions. Exported rows take
precedence over authored projections with the same ID. The fixture preserves
source basenames, complete original-file SHA256 values, candidate indices,
verbatim comparison fields, and authored acceptance/failure states. It does
not manufacture persistence, status, verdicts, or current-bank completeness.
Original bytes and exact projections were verified read-only with the command
below. The JSON report also hashes the fixture, rules module, and replay script.

**Important provenance limit:** the reservation pilot is a saved authored
candidate with `accepted: false` and `failure_stage: judge`, not a verified
persisted DRAFT. It is absent from this saved bank. Bank-only replay vetoes the
nested and join repeats; the reservation repeat is vetoed only when the labeled
historical authored comparison set is added. This replay is not proof that all
founder-reviewed pilot questions were persisted or that the live bank is current.
No authored-only row is injected into the production comparison path.

## Whole-bank wiring audit

- `scripts/run_domain_batch.py:export_questions` fetches every page for the
  selected exam with `status=in.(ACTIVE,DRAFT)` and no objective, section,
  generation-run, or pilot filter. It continues until an empty page even if a
  server page is shorter than the requested limit.
- `shared/near_duplicates.py:load_export` keeps both statuses and preserves each
  PDE key, all three distractors, certification provenance, and scenario text.
- `scripts/generate_pmle_questions.py` compares the frozen full export plus
  earlier same-batch plans/questions before retrieval and at ordered publication.
  Written choices take priority over earlier plan actions.
- `scripts/repair_candidates.py` checks repaired written choices against the
  frozen bank and prior candidates. `scripts/ingest_external_verdicts.py` checks
  the frozen bank and prior candidates, plus the rolling publication bank when
  supplied by the recovery path.

There is no pilot-exclusion filter to remove and no generator integration change
required for actual ACTIVE/DRAFT bank rows. Missing historical persistence needs
separate reconciliation, not invented status. The replay-only `project_authored`
helper is a small safe projection for labeled historical comparisons; it does
not authorize ingestion or assert that an authored candidate passed its judges.

## Conservative rules

Nested keys require typed ARRAY/STRUCT storage. Reservation keys require a
separate baseline reservation and project assignment. Assigning a data/storage
project is kept distinct from assigning the workload project. Join-rewrite keys
require an explicit rewrite plus row-expansion evidence in the scenario; LAG or
aggregation alone is insufficient. Every new family still needs two matching,
order-independent distractor alternatives. Different skeletons and negated
choices remain allowed. Existing lifecycle/distinct families, lexical thresholds,
scenario/key Jaccard veto, and all quality gates remain in place. One narrowly
recognized nested distractor claim, "guarantee that their joins require no shuffle",
is treated as a claimed effect, not as negation of the keep-the-join action;
other negation guards are unchanged.

## Reproduce

From the repository root, without credentials or live calls:

```sh
cd content-pipeline
env -i PATH="$PATH" HOME="$HOME" uv run python -m scripts.replay_pde_answer_patterns \
  --source-dir /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation \
  --output calibration/pde-answer-pattern-replay.json
```

Omit `--source-dir` for portable fixture-only replay. No model, network, or
database call is made. JSON details: [pde-answer-pattern-replay.json](pde-answer-pattern-replay.json).

Focused native uv test gate: **102 passed**, two existing dependency deprecation
warnings. Tests cover all three saved written/plan/projection pairs, both saved
positive controls, option reordering, ACTIVE and DRAFT pagination through the
real export/load/veto functions, source-hash failure, unchanged old families,
negative decisions, wrong assignment targets, and insufficient distractor matches.
