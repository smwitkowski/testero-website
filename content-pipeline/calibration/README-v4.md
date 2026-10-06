# Rules-v4 calibration — 2026-10-06

**Implementation complete. Calibration acceptance target NOT met. Pilot not run.**

- Rejected **12/13** founder-flagged items (target ≥11: met).
- Kept **3/8** founder-approved items (target ≥6: not met).
- Final gate results have **0 ERROR / 0 SKIP**. All 21 exact frozen captures,
  source hashes and per-option quote checks passed.
- Claude CLI **Sonnet 5.5**. Separate strict DSPy gate schemas; confidence/score
  ≥0.8 and every required check. Combined means all three pass, never an average.
- **146/150 call reservations**: 63 baseline +10 explicit diagnostic retries
  +31 interrupted iteration +42 corrected recovery. Of these, 124 completed,
  19 failed schema validation and 3 interrupted outcomes remain unresolved and
  consumed. The final 4 calls were not used.

## Final table

| Item | Founder | Blind | Style | Evidence | Combined |
|---:|:---:|:---:|:---:|:---:|:---:|
| 1 | flag | PASS | FAIL | PASS | FAIL |
| 2 | flag | PASS | FAIL | FAIL | FAIL |
| 3 | ok | PASS | FAIL | PASS | FAIL |
| 4 | flag | PASS | FAIL | PASS | FAIL |
| 5 | flag | PASS | FAIL | PASS | FAIL |
| 6 | flag | PASS | FAIL | FAIL | FAIL |
| 7 | ok | PASS | FAIL | FAIL | FAIL |
| 8 | ok | PASS | FAIL | PASS | FAIL |
| 9 | ok | PASS | PASS | PASS | PASS |
| 10 | flag | PASS | FAIL | FAIL | FAIL |
| 11 | ok | PASS | FAIL | PASS | FAIL |
| 12 | flag | PASS | FAIL | PASS | FAIL |
| 13 | ok | PASS | PASS | PASS | PASS |
| 14 | flag | PASS | FAIL | PASS | FAIL |
| 15 | flag | FAIL | FAIL | PASS | FAIL |
| 16 | flag | PASS | FAIL | PASS | FAIL |
| 17 | ok | PASS | PASS | PASS | PASS |
| 18 | ok | PASS | FAIL | PASS | FAIL |
| 19 | flag | PASS | FAIL | PASS | FAIL |
| 20 | flag | PASS | FAIL | PASS | FAIL |
| 21 | flag | PASS | PASS | PASS | PASS |

Blind: 20 PASS /1 FAIL. Style: 4 PASS /17 FAIL. Evidence: 17 PASS /4 FAIL.
Combined: 4 PASS /17 FAIL (one pass is founder-flagged item21).

## Why the retention target was not reached

Approved items **3,7,8** use the full platform name in their stems, which the
new v4 naming rule forbids. Keeping six unchanged approved items is therefore
impossible under that rule: the naming-only ceiling is five of eight. No input
was rewritten and no check was waived to raise agreement.

The critic also rejected approved item11 for three near-clone tuning options
and a region/endpoint hinge. It rejected item18 for a legacy/broken alternative
and function-name trivia. It accepted flagged item21 as a meaningful monitoring
strategy decision. These remain genuine disagreements with the founder, not
transport errors. General O3/O5 clarifications improved retention from1 to3;
no prompts included item IDs, verdicts, notes or per-item exceptions.

## Evidence and limitations

The final report is **explicitly mixed-provenance**. All21 style and evidence
outputs are fresh under verified reason-schema bounds (`minLength:1`,
`maxLength:300`). The21 blind outputs came from baseline/diagnostic calls.
Their learner prompts match current prompts byte-for-byte. Their raw outputs
revalidate against the corrected strict schema. Original input/schema hashes
and source iteration remain recorded; none was relabeled as a fresh call.

Every item's whole round was held out from founder-approved exemplars. Founder
labels/notes were not gate inputs. No official Google sample text was copied.
Only matching frozen product docs were used; no Exa, OpenRouter or DB calls.
This is small-sample calibration, not unseen-item validation or publication.

Initial schema errors came from reasons longer than the strict local300-character
bound. Diagnostic outputs preserved lengths307/371/354. A subsequent premature
schema freeze was caught by native tests: DSPy Annotated constraints had been
lost in `output_model`. `field.rebuild_annotation()` fixed the export; actual
emitted bounds were verified before corrected recovery. Old schemas remained
byte-exact in9 native comparisons. No reason was truncated to make it pass.

## Reports and commands

- `founder-21-v4-corrected-mixed.json`: authoritative final table, reasons,
  booleans, confidence/scores, source checks, request/schema hashes and provenance.
- `founder-21-v4-baseline.json`: original63-call results (ERROR separate fromFAIL).
- `founder-21-v4-diagnostic-retry.json`: explicit same-request diagnostic results.
- `founder-21-v4-iteration2-partial.json`: interrupted run; unused for final results.
- `founder-21-v4-diagnosis.json` and `founder-21-v4-recovery.json`: measured failures,
  schema-export incident, budget accounting and recovery authorization.
- `PILOT-v4.md`: exact founder command sequence for30 items, sections1–6 at
  **4/5/6/6/5/4**, Codex writer, three external Claude gates, parallel3, then
  judge→repair→judge→ingest dry-run. **Not executed by the worker.**

Offline code gate: `cd content-pipeline && uv run pytest -q` → **1,819 passed,
48 subtests passed,25 existing dependency warnings**. Core local commit:
`a458f4db214410fd486fff15f411732ad447655c`. No push.
