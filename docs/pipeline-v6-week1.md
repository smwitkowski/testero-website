# Pipeline v6 week 1 — coordinator runbook

No live model calls, paid APIs, production writes, deployment, scheduler edits or merge were used to implement this branch. All live commands below are for the coordinator only, after merge and migration approval.

## Apply in order (coordinator only)

1. `supabase/migrations/20261025100000_pipeline_v6_publication.sql` — revision/content hash, service-only events and locked lifecycle RPCs.
2. `supabase/migrations/20261025110000_pipeline_v6_report_quarantine.sql` — report dedupe, global daily quarantine cap, floor and mock reports.
3. `supabase/migrations/20261025120000_withdrawn_session_questions.sql` — refuse withdrawn answering/reveals and exclude mock scoring.

Do not use `supabase db push`, link or project-ref against production from the worker. The coordinator applies reviewed migrations through the approved deployment process.

## What changed

- Quality vetoes do not stop ready candidates from reaching judgment and DRAFT ingest. System retries are bounded to two additional attempts. Frozen PDE retry/resume invariants remain in force; exhausted system cohorts can still block whole-wave admission, but ready requests are judged first.
- New `short_circuit_v2` requests require separate learner-only shuffled Argon blind solving (request version 3). Frozen review-only requests still ingest as DRAFT, but can never satisfy v6 publication.
- `publish_batch.py` is the sole v6 publisher. Every seat must provide its complete schema and PASS, both blind answers must equal the key with confidence at least 0.8, and freshness must pass. It validates frozen request/source/receipt/registry/journal provenance, stored grounding and all answer explanations. It compares label-independent canonical content and calls a row-locked hash-recomputing RPC.
- Shadow mode is default. An explicit current DB read needs `--read-db`; offline reports need `--questions`. `--apply` reads current rows, never an offline export. A pre-write durable checkpoint preserves ambiguous outcomes; reconcile event history before retrying an unknown write.
- Canary requests have the normal judge-visible shape in a separate marked tree. Ingest and publisher hard-refuse that tree before DB access. First two defect types ship (swapped key and retired name). Missing/malformed judgments are errors, not catches. Rolling windows are at least 20 per type. Gold below 80% pages without a pause.
- Critical reports quarantine immediately, subject to the domain floor and abuse cap. Re-council binds hash, revision and latest quarantine cycle; uncertainty or errors never retire a question.
- Saved diagnostic/practice/mock sessions recheck current status. Withdrawn items are skipped with a notice. Mock totals exclude them. Mock review includes reporting.
- Nightly wrappers contain no paid generation fallback. Paid transport reservations enforce weekly caps, and unknown cost is not treated as zero. PMLE inventory revalidates every 300 seconds. Shared per-cert cache generalization is week 2.

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

The task-authorized files `hq/tools/pipeline-nightly.sh` and `hq/tools/judge-and-ingest.sh` were written directly outside this Git repository. Their SHA-256 values and syntax checks are recorded in the verification manifest. The old rotation wrapper and scheduled task were not changed. Before scheduling, set `TESTERO_FRONTEND_DIR` to the approved merged checkout and install its dependencies. Do not run this development worktree as an unattended production source.

## Verification limits

The default local browser suite skips dedicated beta-bank, production-server-only, and manual/seeded QA capture cases. The required withdrawal test is not skipped. Its real local diagnostic, practice, mock answer, scoring, review and report-form flow passes. The coordinator's full beta-bank/production QA and live semantic acceptance remain separate checks.
