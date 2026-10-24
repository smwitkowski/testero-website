# Pipeline v6 week 1 — coordinator runbook

No live model calls, paid APIs, production writes, deployment, scheduler edits or merge were used to implement this branch. All live commands below are for the coordinator only, after merge and migration approval.

## Deploy order (coordinator only)

1. Retire the old `run-cert-rotation.sh` schedule before enabling the new nightly. Do not run both schedulers or split their cap ledgers.
2. Apply **A**: `supabase/migrations/20261025100000_pipeline_v6_publication.sql` — revision/hash, service-only events, guarded lifecycle RPCs and variant withdrawal.
3. **Deploy the updated app**. It must handle withdrawn items and work before the new C snapshot columns exist.
4. Apply **B**, then **C**, immediately after the new app is running:
   - `supabase/migrations/20261025110000_pipeline_v6_report_quarantine.sql` — report quarantine, anonymous corroboration, dedupe and caps.
   - `supabase/migrations/20261025120000_withdrawn_session_questions.sql` — persistent item withdrawal/exclusion snapshots and stable completed results/history.
5. Configure the fresh detached `origin/main` nightly worktree with durable external state/cap ledgers. Run two reviewed shadow nights with `PUBLISH_LIVE` absent before enabling publication.

**Do not apply B or C while the old app is still serving.** A report-driven withdrawal during that window can break old session readers. Keep re-council `--apply` disabled until the app and all three migrations are ready.

Do not use `supabase db push`, link or project-ref against production from the worker. The coordinator applies reviewed migrations through the approved deployment process.

## What changed

- Quality vetoes do not stop ready candidates from reaching judgment and DRAFT ingest. System retries are bounded to two additional attempts. Frozen PDE retry/resume invariants remain in force; exhausted system cohorts can still block whole-wave admission, but ready requests are judged first.
- New `short_circuit_v2` requests require separate learner-only shuffled Argon blind solving (request version 3). Frozen review-only requests still ingest as DRAFT, but can never satisfy v6 publication.
- `publish_batch.py` is the sole v6 publisher. Every seat must provide its complete schema and PASS, both blind answers must equal the key with confidence at least 0.8, and freshness must pass. It validates frozen request/source/receipt/registry/journal provenance, stored grounding and all answer explanations. It compares label-independent canonical content and calls a row-locked hash-recomputing RPC.
- Shadow mode is default. An explicit current DB read needs `--read-db`; offline reports need `--questions`. `--apply` reads current rows, never an offline export. A pre-write durable checkpoint preserves ambiguous outcomes; reconcile event history before retrying an unknown write.
- Canary requests have the normal judge-visible shape in a separate marked tree. Ingest and publisher hard-refuse that tree before DB access. First two defect types ship (swapped key and retired name). Missing/malformed judgments are errors, not catches. Rolling windows are at least 20 per type. Gold below 80% pages without a pause.
- One signed-in critical report can quarantine immediately; anonymous reports need two distinct owned hashes in the current publication/restoration cycle. The floor, dedupe and abuse caps still apply. Withdrawing an original also withdraws active variants. Re-council binds hash, revision and latest quarantine cycle. Renames and receipt-only evidence failures need rewrite, not retirement; blocked preparation pages after seven days.
- Unfinished diagnostic/practice/mock sessions persist withdrawal/exclusion on each saved item. Completed results and history keep those snapshot denominators through later restoration. Current status still fences content/reveals. Mock review includes reporting.
- Nightly runs reviewed code from a fresh detached `origin/main` worktree with state/cap ledgers outside it. There is no paid generation fallback. A stage failure blocks publication but still reaches safe re-council work and the digest; hard auth/quota/budget/pause stops do not authorize more paid calls. Unknown cost is not zero. PMLE inventory revalidates every 300 seconds; per-cert cache generalization remains week 2.

## Offline verification

From this repository:

```sh
cd content-pipeline && uv run pytest -q
# Back in repository root:
env -i PATH="$PATH" HOME="$HOME" CI=true npm test
npm run lint
npm run typecheck
npm run build
docker build .
npm run test:db:local
npm run test:e2e:local
```

See `evidence/pipeline-v6/verification.json` for actual completed commands and results. Passing fixtures prove contracts, not live semantic model quality or production readiness.

## Canonical content hash

`shared/content_hash.py` and SQL `question_content_sha256` serialize exact UTF-8 byte-length-prefixed fields under `testero-content-v1|`: stem, correct option text/explanation, distractor count, then distractors sorted by UTF-8 text and explanation. Labels/order do not affect the digest. No trim or Unicode normalization. Shared vectors: `content-pipeline/tests/fixtures/content_hash_vectors.json`. The cached DB column may be null/stale for an edited DRAFT; the publisher and RPC recompute from current complete content rather than trust it.

## Live pilot (coordinator only)

Use a fresh basename. Inject existing subscription logins and EXA/OpenRouter/database credentials using the established op-agent/Secret Manager path. Never read or print an env file. From the merged checkout:

```sh
cd content-pipeline
uv run python -m scripts.run_domain_batch all v6-pilot machine-learning-engineer --count 10
# After DRAFT ingestion, shadow first:
uv run python -m scripts.publish_batch --artifact .cache/generation/machine-learning-engineer-v5-v6-pilot.json --verdicts .cache/generation/machine-learning-engineer-v5-v6-pilot.verdicts --read-db --dry-run --limit 10 --report .cache/generation/v6-pilot-shadow.json
```

The basename above is the runner’s exact `<cert>-v5-<tag>` layout. Use a new tag for every new run. Never reinterpret DRAFT acceptance as ACTIVE publication. Do not run the old fallback judge-and-ingest wrapper. For the same artifact, replace `--read-db --dry-run` with `--apply` only after coordinator approval; the publisher re-reads current DB content and checks its hash atomically.

## Nightly, health, re-council, provenance and scheduler

See `docs/pipeline-v6-nightly.md` for the exact offline print, shadow-night, flag-file live switch, credential-safe preflight, weekly budget/digest and scheduler replacement commands. Scheduler edits belong to the coordinator, not this worker.

See `content-pipeline/docs/council-health-v6.md` for separate prepare → live judge → evaluate commands and the required D-029/PDE gold corpus. See `content-pipeline/docs/recouncil.md` for queue export and separate prepare → full council judge → apply commands. A missing gold corpus or ungrounded queue row is a real blocked gate, never a successful no-op.

## Deferred

- Third canary mutation (second defensible answer) is deferred: deterministic mutation cannot establish semantic defensibility safely; the first two types ship with full rolling-window tests.
- Week-2 work remains out of scope: per-revision answer statistics/instrumentation, mechanism-dedupe calibration, decision-catalog A/B, shared per-cert count cache and broad quote-freshness scheduling.
- The full D-029 pilot-12 and accepted PDE gold corpora are not in this checkout. Tests replay recorded accepted fixtures and frozen verdicts, but cannot prove full-corpus semantic quality. The coordinator must supply both artifact paths; nightly refuses missing inputs.
- Two live shadow nights and semantic pilot review remain coordinator work after merge. No live-quality claim is made here.
- Nightly live admission also needs reviewed current pricing and historical spend logs, sender/recipient configuration, and confirmation of the Resend secret name. The example config intentionally cannot authorize paid work.

## External wrapper handoff

The task-authorized files `hq/tools/pipeline-nightly.sh` and `hq/tools/judge-and-ingest.sh` were written directly outside this Git repository. Their SHA-256 values and syntax checks are recorded in the verification manifest. Invoke the new launcher directly: it has a Python shebang despite the retained `.sh` filename. Do not invoke it with `bash`.

The new launcher fetches `origin/main`, requires an exact coordinator-reviewed merged-main SHA through `--reviewed-main`, and creates a fresh detached owned worktree. It never executes this PR worktree or honors `TESTERO_FRONTEND_DIR`. Calls, state, cache and the project environment remain under the dedicated external `hq/pipeline-nightly-runtime/` root. Dirty or drifted retained checkouts fail closed; the launcher never resets or removes them. Prepare dependencies for the reviewed main checkout before scheduling. The old rotation wrapper and scheduled task were not changed by this worker; the coordinator must retire the old schedule before enabling the new one.

## Verification limits

The default local browser suite skips dedicated beta-bank, production-server-only, and manual/seeded QA capture cases. The required withdrawal test is not skipped. Its real local diagnostic, practice, mock answer, scoring, review and report-form flow passes. The coordinator's full beta-bank/production QA and live semantic acceptance remain separate checks.

## Trusted lifecycle boundary (review m6)

The SQL RPC checks current content, integrity, revision, floor and lifecycle rules. The complete council evidence remains a Python publisher responsibility. Service-role callers and database administrators are trusted: they can supply the current hash, set the local lifecycle flag, or bootstrap privileged rows. The guard prevents accidental direct UPDATE bypasses; it is not a cryptographic council attestation against a compromised service role. Keep that role server-only and use `publish_batch.py` for publication. Anon/authenticated roles have no question-write or lifecycle RPC privileges. Setting a custom transaction variable does not grant those privileges; the app exposes no general SQL/flag-setting endpoint.
