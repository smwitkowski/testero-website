# Quarantine re-council (pipeline v6)

`scripts/recouncil.py` never invokes a model. Default mode reads local JSON,
prepares new council requests, and evaluates any supplied verdict files. It does
not connect to a database. `--dry-run` makes this default explicit. `--apply`
is a separate coordinator-only authorization for lifecycle RPC calls.

## Queue export contract

Supply `--questions queue.json` (`--queue` is an alias). The file is either a
list of question rows or `{"questions": [...]}`. Each row needs:

- `id`, `stem`, `revision`, `content_sha256`, `status`, `review_status`.
- `review_status = "QUARANTINED"` and `status = "DRAFT"`.
- `exam`, `domain_id`, `domain: {id, code, exam}` from the DB domain row.
- `answers`: four DB-shaped records with `choice_label`, `choice_text`,
  `is_correct`, and `explanation_text`. There must be exactly one key.
- `review_notes` (JSON string or object), with `grounding.cert_id`,
  `grounding.objective_id`, optional `grounding.domain_code` and
  `grounding.guide_sha256`, and `grounding.evidence` receipts if available.
- `question_events`: ordered or unordered DB event rows. Include `id`, `at`,
  `action`, `revision`, and `payload`. At least the latest `quarantined` event
  for the current revision is required. Include earlier `restored` and later
  `report` events to detect repeat reports. Alternatively, provide one top-level
  `question_events` list with `question_id` on each event.

A receipt needs `option_label`, `url`, `quote`, `retrieved_at`, and
`text_sha256`. Receipts use DB answer labels and are remapped together with the
key. Full captured document records may be supplied as `grounding.sources` or
row `sources`; they must retain their original fetch provenance and text hash.

## Coordinator commands

From `content-pipeline`, with a fresh local queue export and a fresh run folder:

```sh
# Offline prepare. Optional --artifact-root searches stored generation artifacts.
uv run --frozen --offline python -m scripts.recouncil \
  --queue queue.json --output-dir recouncil-run \
  --artifact-root .cache/generation --report recouncil-report.json

# LIVE coordinator step only. Requires separately injected runtime credentials.
# Always use full-gate-sample 1: re-council must not short-circuit seats.
uv run --frozen python -m scripts.judge_requests \
  --requests recouncil-run/judge-requests --verdicts recouncil-run/verdicts \
  --argon-gate --full-gate-sample 1

# Offline evaluate first; omitting --apply never writes the DB.
uv run --frozen --offline python -m scripts.recouncil \
  --queue queue.json --output-dir recouncil-run \
  --artifact-root .cache/generation --verdict-dir recouncil-run/verdicts \
  --report recouncil-report.json

# Coordinator-only apply: same command with --apply.
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must already be injected in shell.
# No dotenv files are loaded. Never print credentials.
```

All model and database actions above are coordinator instructions, not evidence
of live validation. Local tests use frozen question content, synthetic verdicts,
and mocked RPCs only.

## Decisions and safety

- Stored artifacts are read-only. Their canonical stem/key/distractor explanation
  hash must equal the recomputed DB row hash and stored `content_sha256`.
  Artifact mismatch, ambiguity, or corruption never falls back to another source.
- Missing artifacts use the current DB learner item, key, all option explanations,
  and stored receipts. Receipt-only prompts explicitly state that full source
  bodies and current document availability are not known. No fetched page is
  fabricated from a quote. Missing/invalid evidence keeps the item quarantined.
- New requests use the current objective style policy (including PDE 5.3),
  preserve a validated stored distractor-evidence policy, and require every field
  of each selected schema. Mixed evidence policies fail closed. Scope planning
  disables generation tuning, not current style checks.
- New requests use the current blind-Argon contract, not legacy review-only
  requests. The request filename binds the question, revision, content hash and
  latest quarantine event. Use a fresh verdict directory for each cycle.
- Restore requires all seats to pass the strict publisher helper, including both
  blind answers at confidence >=0.8 and deterministic freshness.
- Retirement requires a complete, schema-valid council with no UNCERTAIN seat.
  A confident, unambiguous blind key disagreement can retire. An explicit
  evidence FAIL can retire only with validated captured source context (from
  an artifact or the DB export), never from receipts alone. A deterministic
  lexicon hit with status `retired` can also retire.
- Lexicon hits with status `renamed` remain quarantined with `needs_rewrite`.
  Receipt-only evidence FAIL also remains quarantined with `needs_rewrite`.
  These conservative rewrite blockers take precedence even if a blind solver
  disagrees or a retired-name hit also exists. Such signals do not establish
  an independent key defect. Rewrite and run a fresh full council before any
  transition; this script does not rewrite content automatically.
- Style-only rejections, REVISE, low confidence, skipped seats, malformed output,
  missing verdicts and system errors keep the item quarantined. An error never
  triggers retirement. Publisher freshness vetoes remain unchanged for both
  retired and renamed names.
- `--apply` calls only `restore_question` or `retire_question`, with the expected
  content hash and payload fences `expected_revision` and `quarantine_event_id`.
  The DB RPC is responsible for current-state fences and atomic audit writes.
  Only a response with `changed: true` is reported as applied. Errors or unknown
  responses require event reconciliation; no fallback write is attempted.
- Report `pages` entries identify a report after a same-revision restoration.
  They also page `quarantine_preparation_blocked_7_days` when a DRAFT QUARANTINED
  row cannot prepare a request (for example, no usable artifact or receipts)
  and its latest current-revision quarantine cycle is at least seven days old.
  A new cycle resets the clock. Aging never restores or retires a question.
- Cycle timestamps must include a timezone. Ordering uses parsed UTC instants,
  not timestamp strings. Missing, malformed, naive or future timestamps block
  age calculation explicitly and page `quarantine_age_blocked`; no invented age
  is used. `run_recouncil(..., now=aware_datetime)` supports fixed-clock tests;
  a run otherwise captures one UTC clock value at its start.
- The nightly notifier owns email delivery and daily dedupe. This script sends
  no email and does not mark events delivered.

Offline verification:

```sh
PYTHON_DOTENV_DISABLED=1 uv run --frozen --offline pytest -q tests/test_recouncil.py
```
