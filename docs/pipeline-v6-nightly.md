# Pipeline v6 nightly (coordinator runbook)

This code was built and tested offline. It did not run models, retrieve keys,
read login state, call production, apply migrations, merge, or deploy.
Deployment order is mandatory: apply migration A (including the lifecycle guard),
deploy the reviewed app, then apply B and C immediately. Do not apply B/C while
the old app still serves sessions. Use the approved coordinator process only.

## Files and safety

- `content-pipeline/scripts/pipeline_nightly.py`: orchestration and durable stop checkpoints.
- `nightly_plan.py`: complete local coverage snapshot → weighted domain gaps.
- `nightly_preflight.py`: isolated, tool-disabled subscription quota probe; default print.
- `nightly_budget.py`: `*.calls.jsonl` accounting using `token_report.summarize`.
- `shared/nightly_budget.py`: opt-in, process-locked reservations before paid calls.
- `nightly_digest.py`: credential-free `--print`; explicit runtime `--send` through Resend.
- `nightly-config.example.json`: no secrets. Copy it to coordinator-owned config.
- External `hq/tools/pipeline-nightly.sh`: small runtime credential-injection wrapper.
- External `hq/tools/judge-and-ingest.sh`: retained, marked RETIRED, exits without calls.

Retire/disable the old `run-cert-rotation.sh` schedule **before** enabling the new
nightly schedule. Do not run both. The old rotation and its worktree are not
modified by this wrapper. There is no paid generation fallback.

The external `.sh` launcher is an executable Python 3 program (keep its shebang;
do not invoke it with `bash`). Its source lives in coordinator-controlled `hq`,
not in the editable PR checkout. The coordinator must inspect/install that source
before enabling it. It never imports implementation-worktree code. Live launch:

1. Lock `hq/pipeline-nightly-runtime/launcher.lock` for the entire child lifetime.
   Check the runtime owner marker. Existing unmarked directories are refused.
2. Check all previous owned checkouts for dirt, HEAD/branch drift and git ownership.
   Refuse any change rather than resetting, cleaning or discarding files.
3. Fetch `origin/main` from `Testero/frontend`. Require its fresh full SHA to equal
   the explicit coordinator-reviewed `--reviewed-main` pin. A mismatch stops
   before credentials or repository code run. Review/update the pin deliberately;
   never substitute the PR HEAD or automatically accept a new main SHA.
4. Create a **new detached worktree** at that exact SHA under
   `hq/pipeline-nightly-runtime/worktrees/`. Do not check out/reset the source
   checkout, this worker, or `frontend.prime-testero-pipeline`.
5. Inject runtime keys and run the pinned coordinator with frozen offline uv
   dependency resolution. `UV_PROJECT_ENVIRONMENT` is outside the checkout.

`state/`, `calls/`, and `cache/` live under `hq/pipeline-nightly-runtime/` and are
shared across nights. The wrapper requires `calls_root` to be the exact absolute
`.../hq/pipeline-nightly-runtime/calls` path. The checkout's `.cache` is an owned
symlink to durable `cache/`; batch/request paths are resolved to real paths before
strict no-symlink input checks. Artifacts, reservations, publication slots,
checkpoints, and mail claims survive a checkout change. Never clear them to retry.
Prior worktrees are retained for inspection, not automatically deleted. Any dirt
outside the owned cache link stops the next run, including ignored files.
The coordinator may archive/remove a worktree only after reconciling its record;
the wrapper itself has no reset/clean/delete path. Do not run other writers in
these dedicated worktrees. The launcher lock protects cooperating invocations,
not arbitrary human edits or a distributed cross-machine writer.

`lib/pmle/inventory.ts` now revalidates after 300 seconds. Count failures still hide
the count. Per-cert count/cache generalization is a week-2 seam, not shipped here.

## Configuration and caps

Use absolute paths in the coordinator config. Set sender and recipient explicitly.
Supply accepted frozen source artifacts for canaries and the D-029 + accepted PDE
gold corpus. Missing corpora stop the run; they never become a passing no-op.

Configure reviewed **upper-bound** OpenRouter input/output USD per million tokens
under the exact model id `openrouter/google/gemini-4-argon`. Configure Exa maximum
request, result, and text-result USD prices under `exa_upper_bound`. The example
intentionally has no valid prices. It must not authorize paid work until the
coordinator confirms current provider pricing and any surcharges. Token counts
alone are not dollars. Missing cost/rates/usage, malformed logs and unknown
providers stop paid work. Never delete logs to get around a closed budget gate.
All nightly and manually run pipeline paid calls must share `calls_root`; include
all current-week historical `*.calls.jsonl` there. Reconcile any historical
unmetered Exa spend first; absence of old Exa logs is not evidence of zero spend.

Weekly UTC limits reset Monday: OpenRouter $10; Exa $5. A coordinator may add a one-time raise in the config as `"cap_overrides": [{"provider": "openrouter", "usd": "20", "until": "<UTC ISO time within this week>"}]`; it expires automatically and invalid entries fail closed. Reservations use the
serialized text UTF-8 byte length plus 4096 framing tokens and the output bound.
This overestimates input tokens. Full upper-bound reservations remain charged even
when a call fails; there are no unsafe refunds. One file lock serializes admission
across processes. Reservation IDs deduplicate artifact telemetry and the guard
ledger. Accounting reports token-usage coverage separately from dollar bounds.
DSPy hidden transport retries are disabled only in nightly mode. Each explicit
retry reserves again. The inspected Exa SDK issues one request per search.
Re-check these transport assumptions when dependencies change.

A reservation is a conservative local spending bound under the coordinator's
reviewed price maxima, not a provider invoice or a provider-side account cap.
Other applications using the same keys are outside this local ledger. Keep those
keys scoped to this serialized pipeline or account for that spend separately.
Do not enable provider failover or change price/config mid-run.

The runner permits at most two batches/night and ten new publications/UTC day.
Daily reservations share the budget-root lock, even across separate state dirs.
Batch slots are claimed before generation. Publication slots are claimed directly
before publishing and never refunded on unknown outcomes. Two planned batches get
at most five slots each. This can underuse the allowance; it cannot silently reuse
an uncertain slot. The runner also reads `question_events` before each batch and
again before publication. Serialize **all** other publication
commands with the coordinator; a separate writer that bypasses nightly can evade
a local daily cap. Restores do not count as new publications.

## Offline preview (no credentials, models, DB, or email)

Run from `content-pipeline/` with a local complete export:

```sh
uv run --frozen --offline python -m scripts.pipeline_nightly \
  --config nightly-config.example.json --coverage /absolute/coverage.json \
  --tools-dir /absolute/hq/tools --state-dir /absolute/durable/nightly-state --print
```

Export shape: `{"complete":true,"captured_at":"UTC ISO timestamp","questions":[...]}`.
Each question includes `id,exam,status,review_status,parent_question_id` and
`domain:{id,code,exam}`. Include all pages and certify `complete` only after a
complete export. An empty list is useful as a synthetic planner test, not a live
bank claim. Preview exports older than 24 hours fail. The planner excludes
variants and non-ACTIVE/non-GOOD rows. Target = 400 PMLE originals, 40 for each
enabled beta. Gap = target × guide weight − live. PMLE gaps get 2× priority.
Agentic Architect stays disabled. Objective-grid/demand-tier planning is deferred.

`--dry-run` is an alias for offline print. It is **not** a shadow model night.
Neither mode checks actual logins, keys, quota or DB state.

The external wrapper's `--print` (also the default and `--dry-run`) is a
credential-free **launch plan only**. It reads the explicit JSON config but does
not fetch, create directories/worktrees, import repository code, or start uv.
Use the repository command above for a batch-level offline preview. A wrapper
preview never implies that the configured pin exists on main or was reviewed.

## Coordinator-only shadow and live commands

The external wrapper gets Supabase from Secret Manager and OpenRouter/Exa from
op-agent exactly as the old wrapper did. Resend comes from Secret Manager;
confirm `testero-resend-api-key` or set `TESTERO_RESEND_SECRET` to the approved
secret name. No key value is printed or saved. No env file is loaded.

```sh
# Runtime probes + generation/judging/DRAFT ingest + shadow publication reports.
# This writes DRAFTs; it does not publish/restore/retire while the flag is absent.
# PUBLISH_LIVE must be absent. Do this on two distinct nights and compare reports.
/Users/switkowski/Projects/Testero/hq/tools/pipeline-nightly.sh \
  --config /absolute/coordinator-nightly-config.json \
  --reviewed-main COORDINATOR_REVIEWED_FULL_MAIN_SHA --live

# ONLY after the two shadow nights pass coordinator review:
touch /Users/switkowski/Projects/Testero/hq/tools/PUBLISH_LIVE
# Same command now allows strict publisher/re-council RPC writes.
/Users/switkowski/Projects/Testero/hq/tools/pipeline-nightly.sh \
  --config /absolute/coordinator-nightly-config.json \
  --reviewed-main COORDINATOR_REVIEWED_FULL_MAIN_SHA --live
```

Live means model/network execution. Generation still ingests accepted DRAFTs in a shadow night. The flag controls ACTIVE publication/restore/retirement, not DRAFT ingestion or whether paid calls occur. The flag is checked again before publish.
Remove it to return to shadow. Create `hq/tools/PIPELINE_PAUSED` to stop model calls and lifecycle writes.
Read-only queue reporting, local evaluation and the digest can still proceed.
Health writes this pause itself on an escaped canary or bad rolling catch rate.
Only the coordinator removes it after diagnosis.

Sequence: preflight (CLI authentication, runtime keys, subscription quota probes)
→ pause check → fresh paginated bank export/weighted gap plan → isolated canaries
and gold → generate/judge/ingest → strict publisher → fresh quarantine queue →
re-council prepare/judge/evaluate → digest. Health is deliberately before publish
(a stronger order than the initial task list) so a first escape cannot consume
real publications. Gold below 80% pages; it does not itself pause publishing.
Canary requests remain isolated and can never enter ingestion or publication.

The runner uses `run_domain_batch` (which owns generation, independent judging,
and DRAFT-only ingest), then `publish_batch --read-db --dry-run`; only the flag
switches that to `--apply`. It never uses diagnostic `verify_batch.py` to publish.

The quarantine export includes `domain:{id,code,exam}`, revision/hash, options,
review notes and question events (including the latest quarantine event). Its
sequence is:

```sh
uv run --frozen --offline python -m scripts.recouncil --queue QUEUE.json \
  --output-dir RUN --artifact-root "$PWD/.cache/generation" --report prepare.json
uv run --frozen --offline python -m scripts.judge_requests \
  --requests RUN/judge-requests --verdicts RUN/verdicts \
  --judge-model claude --argon-gate --full-gate-sample 1
uv run --frozen --offline python -m scripts.recouncil --queue QUEUE.json \
  --output-dir RUN --artifact-root "$PWD/.cache/generation" \
  --verdict-dir RUN/verdicts --report recouncil.json --apply
```

These commands can make live model/DB calls despite uv's `--offline` dependency
flag. Omit `--apply` to evaluate without changing DB state.

## Stops and email

Every live night claims durable `state/YYYYMMDD/checkpoint.json`. A second same-day
invocation refuses that checkpoint. No automatic generation or publication replay
runs, and an uncertain write keeps its batch/publication reservation. Inspect
artifact/persistence journals and DB events before any manual recovery.

Failure handling is explicit:

- A runner terminal `nightly-stage-v1` **partial** result proves an ordinary
  candidate/transport failure using a narrow error-class allowlist. Generic CLI,
  provider or unknown errors cannot produce this proof. The coordinator skips
  the remaining generation cohorts and **all remaining new publications** that
  night, but still processes the independent re-council queue and digest.
  Earlier confirmed publications are not rolled back.
- Auth, quota, budget, `PIPELINE_PAUSED`, a removed live flag, missing/malformed
  result files, and unknown persistence outcomes are **hard stops**. No further
  model calls or lifecycle writes run. The runner checks structured failures
  before judging/retrying a failed generation stage; it does not treat a generic
  nonzero exit as a quality veto. No paid fallback runs.
- After a hard stop, an available DB client may read a fresh quarantine queue.
  Local re-council preparation and `--dry-run` evaluation can record retained
  quarantine reasons without new judging or RPCs. A failed re-council judge is
  not retried by the coordinator; local dry evaluation and digest still run.
- A monitor failure blocks publication and is conservatively a hard stop unless
  a future stage supplies an explicit safe partial proof. Canary auto-pause
  therefore cannot lead to paid re-council calls. Gold pages without a stage
  failure remain reporting only.

Live flag/pause/budget fences still run before paid or write stages. The local
`digest.txt` is saved even when email delivery fails. Final status is `partial`
for an ordinary stage failure and `checkpointed_stop` for a hard stop; both exit
nonzero. The next UTC day can make a fresh bounded plan. This is safe checkpointing,
not an atomic multi-stage transaction or a generic resume engine.

Weekly digest and immediate pages use Resend. Sender/recipient come from config.
The digest aggregates observed local checkpoints for the current UTC week and
shows its publication denominator. Four-gate agreement uses only complete real
verdicts (Claude blind/style/evidence and combined Argon blind+review); missing or
short-circuited seats are excluded, not counted as votes. Two consecutive observed
batch yields below 15% page the founder. Metrics are observations, never authority
to publish. Defects-per-exposed-question remains unavailable without exposure
instrumentation; the digest must not invent that denominator.
The daily page claim is saved **before** sending; unknown delivery keeps the claim
to prevent duplicates. Check Resend before manually retrying. Weekly digests are
claimed once per UTC week. Missing/unmeasured metrics are explicit, never zero:
answer statistics stay dormant; freshness age and site-vs-DB independent comparison
remain week-2 work.

```sh
uv run --frozen --offline python -m scripts.nightly_digest \
  --report /absolute/hq/pipeline-nightly-runtime/state/YYYYMMDD/checkpoint.json --print
```

## Exact scheduler change (coordinator only)

Do not edit the scheduler as an implementation worker. In
`~/.claude/scheduled-tasks/testero-question-rotation/SKILL.md`, replace the existing
execution command/body that calls `hq/tools/run-cert-rotation.sh` (and any old
checkout/reset/fallback instructions) with:

```sh
/Users/switkowski/Projects/Testero/hq/tools/pipeline-nightly.sh \
  --config /absolute/coordinator-nightly-config.json \
  --reviewed-main COORDINATOR_REVIEWED_FULL_MAIN_SHA --live
```

Keep its existing nightly time. Add: "Run exactly this wrapper once. Never reset
or change checkouts, run the retired fallback, remove PIPELINE_PAUSED, create
PUBLISH_LIVE, fetch secrets outside the wrapper, retry an uncertain checkpoint,
or substitute paid generation. Nonzero means stop and inspect the checkpoint."
The coordinator must substitute the actual reviewed config path and full merged
main SHA above, disable/retire the old rotation **before enabling** this command,
and record the two shadow-night reports before creating the flag. When main
changes, review the new main commit and explicitly update the pin; the wrapper
must fail closed while the old pin remains.
No scheduled-task file was read or changed by this worker.

## Verification

```sh
cd content-pipeline
PYTHON_DOTENV_DISABLED=1 uv run --frozen --offline pytest -q \
  tests/test_pipeline_nightly.py tests/test_draft_provenance.py
```

Tests use local fixtures and fake transports. They prove caps, fail-closed costs,
reservation concurrency, no generation fallback, quota checkpointing interfaces,
print mode, kill switch, typed partial vs auth/quota/unknown outcomes, continued
re-council/digest, and email dedupe. Native temporary local Git fixtures prove
fresh detached pinning, lock exclusion, durable cache and dirty-tree refusal.
Wrapper tests skip when the external hq launcher is not installed in a clone.
They never invoke the wrapper live entry point. They do not prove live authentication,
pricing, model quality, deliverability or production readiness.

## Item 8: draft provenance and legacy retirement

`content-pipeline/sql/draft_provenance.sql` is read-only SQL, not a migration. It
uses `BEGIN READ ONLY` and rolls back. It counts PMLE DRAFTs by the strict UTC
2026-10-04 boundary, generation run, review status, and a local persisted-artifact
id manifest. SQL cannot inspect the coordinator's filesystem; supply the manifest
explicitly with psql's quoted `artifact_ids` variable. An unavailable/missing
artifact root fails rather than claiming that no artifact exists.

From `content-pipeline/`:

```sh
# Offline. No env files, DB, generation, judging, embeddings or retrieval.
uv run --frozen --offline python -m scripts.draft_provenance \
  --questions /absolute/pmle-draft-export.json \
  --artifact-root "$PWD/.cache/generation" --report /absolute/provenance.json

# Offline manifest for the committed read-only SQL. Use the complete artifact root.
uv run --frozen --offline python -m scripts.draft_provenance \
  --artifact-root "$PWD/.cache/generation" --artifact-ids > /absolute/artifact-ids.json

# Coordinator only: approved read-only psql connection configuration already set.
# Shell substitution passes ids, never database credentials, in this command.
psql -v ON_ERROR_STOP=1 -v artifact_ids="$(cat /absolute/artifact-ids.json)" \
  -f sql/draft_provenance.sql

# Coordinator only: explicit current DB read, runtime credentials already injected.
uv run --frozen --offline python -m scripts.draft_provenance \
  --artifact-root "$PWD/.cache/generation" --read-db --report /absolute/provenance-db.json

# Coordinator only, after inspecting the count. This is NOT a migration.
uv run --frozen --offline python -m scripts.draft_provenance \
  --artifact-root "$PWD/.cache/generation" --apply --report /absolute/legacy-retirement.json
```

Local export rows require `id,exam,status,created_at,generation_run_id,review_status`.
Artifact presence means an exact `inserted_question_id` link in a local candidate
artifact, not a candidate id guess, stem match or a request directory. It scans
nested JSON artifacts irrespective of filename and skips `.env*` paths.

`--apply` always reads a fresh DB selection. It retires only PMLE DRAFTs strictly
before `2026-10-04T00:00:00Z`; on/after drafts and ACTIVE questions are untouched.
Each call uses `retire_question` with reason exactly `D-025 legacy` and payload
`expected_status=DRAFT`, `expected_exam=GCP_PM_ML_ENG`, and
`expected_created_before=2026-10-04T00:00:00+00:00`. Migration A checks those guards
under the row lock. An intervening publish cannot turn this selection into an
ACTIVE-question retirement. The row content hash is passed when present.

No direct row UPDATE, deletes, migration, bulk promotion or production operation
is performed by this implementation worker. RPC errors/unknown outcomes stop
further calls. Apply requires `--report` and persists an adjacent
`.retire-journal.json` before each RPC and after each confirmed success. Its
`attempting`/`unknown` records are uncertainty, never a failed-write assumption.
Existing journals refuse automatic replay. The script accepts SQL's exact
`outcome=changed` response (not the action name). A stopped report retains prior
successful IDs and the unknown attempt. There is no cross-row transaction:
earlier successful retirements remain. Inspect the journal, `question_events`
and current rows before a manual retry. Old RPC
versions without the eligibility guards must not be used. Post-Oct-4 drafts stay
unpublished; re-grounding/re-council is a separate coordinator action.
