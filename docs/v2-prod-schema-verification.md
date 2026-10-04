# V2 baseline: real-schema local rehearsal

Approved source: 2026-10-03 `schema.sql` and `question-bank-data.sql` from
`/Users/switkowski/Projects/Testero/backups/2026-10-03/`. No `data.sql` or
`roles.sql` was opened, read, copied or loaded. No production connection or remote
migration occurred. Only five non-PII bank COPY blocks were loaded. No local seed. The verifier
whitelists these exact approved paths and rejects other directories/symlink targets
before reading backup contents; changing the backup directory needs explicit review.

## Outcome and limits

First apply succeeds. Second apply has identical complete-row fingerprints and
logical tables/columns/constraints/indexes/functions/policies/triggers/grants.
48 original tables retain names/OIDs; eight additive tables bring the total to56.
All original object definitions remain. Existing canonical extra fields
`questions.stem_embedding vector(1536)` and `answers.explanation` remain intact.
Existing seven matching index names have compatible definitions. No existing
v2 function or policy identity clashes occur in this backup; all five existing
application RPC definitions and all legacy policies are preserved. Incompatible
function identities are refused, not dropped.

**This is not an unconditional production approval.** Local Supabase uses its
standard roles/Auth configuration; production role memberships and user/legacy
rows were deliberately not loaded. All43 non-bank tables are empty locally.
Record actual production counts and inspect role inheritance before apply.
The backup has no `user_subscriptions`; v2 creates it empty. Existing legacy
`subscriptions` rows are preserved, not translated into v2 paid entitlements.
The founder must approve any entitlement mapping and old-client cutover impact.

## Issues found and fixed

1. Existing `upsert_question_answers(uuid,jsonb)` is SECURITY DEFINER and was
   executable by browser roles. It deletes/inserts canonical answers even after
   table-level REVOKE/RLS. Baseline now conditionally revokes PUBLIC/anon/
   authenticated EXECUTE and grants service_role. Function body/identity unchanged.
   No table drops/renames, row rewrites, content backfill or legacy policy changes.
2. Existing DB/browser tests assumed30 seeded questions. Added explicit
   `verify-db:prod` / `e2e:prod` modes: no seed; real inventory, snapshot IDs/text,
   blueprint quotas, canonical explanation equality and unchanged-bank checks.
3. PostgREST embeds unique explanation relationship as an object, not an array.
   Test helper now normalizes it while retaining exactly-one/nonempty assertions.
4. Real options contain long SQL tokens (`MODEL_TYPE='BOOSTED_TREE_CLASSIFIER'`).
   Actual320px summary test exposed overflow. Inherited `overflow-wrap:anywhere`
   fixes it without truncating/replacing bank text or weakening layout assertions.

Pre-existing legacy concerns were preserved, not silently redesigned:
`check_and_increment_practice_quota` is an arbitrary-user SECURITY DEFINER
legacy usage RPC; `get_diagnostic_session_progress` relies on legacy table ACLs
for session/correctness privacy. Legacy hardening is a separate human decision.

## Question-bank health

| Domain | ACTIVE | ACTIVE+GOOD eligible | Diagnostic quota |
|---|---:|---:|---:|
| ARCHITECTING_LOW_CODE_ML_SOLUTIONS |28|27|2|
| COLLABORATING_TO_MANAGE_DATA_AND_MODELS |27|27|3|
| SCALING_PROTOTYPES_INTO_ML_MODELS |29|28|4|
| SERVING_AND_SCALING_MODELS |17|17|4|
| AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES |27|27|4|
| MONITORING_ML_SOLUTIONS |17|17|3|
| Total |145|143|20|

Two ACTIVE rows are NEEDS_ANSWER_FIX and remain excluded by the existing quality
filter. All143 eligible questions have four distinct options, one correct key,
and nonempty per-option explanations (572/572). Each domain can supply five
practice questions. Three actual browser journeys check all20 selected snapshots
against restored ACTIVE+GOOD IDs, exact original stems/options/correctness,
only the six blueprint codes despite29 domains, exact2/3/4/4/4/3 allocation,
and paid per-option explanation text after label shuffling.

## Before / first apply / replay row counts

No user-data dump was loaded: zeros below are LOCAL schema-only legacy tables,
not measurements of production legacy/user rows. Full-row hashes also match.

| Table | Before | After | Replay |
|---|---:|---:|---:|
| `archive.certification_sections` | 0 | 0 | 0 |
| `archive.certifications` | 0 | 0 | 0 |
| `archive.options` | 0 | 0 | 0 |
| `archive.question_responses` | 0 | 0 | 0 |
| `archive.questions` | 0 | 0 | 0 |
| `archive.questions_archive` | 0 | 0 | 0 |
| `archive.test_progress` | 0 | 0 | 0 |
| `archive.tests` | 0 | 0 | 0 |
| `archive.user_answers` | 0 | 0 | 0 |
| `archive.user_certifications` | 0 | 0 | 0 |
| `archive.user_question_practice` | 0 | 0 | 0 |
| `archive.user_question_progress` | 0 | 0 | 0 |
| `public.admin_users` | 0 | 0 | 0 |
| `public.answers` | 1372 | 1372 | 1372 |
| `public.diagnostic_analytics` | 0 | 0 | 0 |
| `public.diagnostic_pool_questions` | 0 | 0 | 0 |
| `public.diagnostic_question_pools` | 0 | 0 | 0 |
| `public.diagnostic_questions` | 0 | 0 | 0 |
| `public.diagnostic_responses` | 0 | 0 | 0 |
| `public.diagnostics_sessions` | 0 | 0 | 0 |
| `public.embeddings` | 0 | 0 | 0 |
| `public.exam_domains` | 29 | 29 | 29 |
| `public.exam_versions` | 0 | 0 | 0 |
| `public.exams` | 0 | 0 | 0 |
| `public.explanations` | 343 | 343 | 343 |
| `public.explanations_legacy` | 0 | 0 | 0 |
| `public.options_legacy` | 0 | 0 | 0 |
| `public.payments` | 0 | 0 | 0 |
| `public.practice_attempts` | 0 | 0 | 0 |
| `public.practice_question_attempts_v2` | 0 | 0 | 0 |
| `public.practice_questions` | 0 | 0 | 0 |
| `public.practice_quota_usage` | 0 | 0 | 0 |
| `public.practice_responses` | 0 | 0 | 0 |
| `public.practice_sessions` | 0 | 0 | 0 |
| `public.products` | 0 | 0 | 0 |
| `public.question_generation_runs` | 165 | 165 | 165 |
| `public.questions` | 343 | 343 | 343 |
| `public.questions_legacy` | 0 | 0 | 0 |
| `public.responses` | 0 | 0 | 0 |
| `public.sections` | 0 | 0 | 0 |
| `public.study_plan_items` | 0 | 0 | 0 |
| `public.subscriptions` | 0 | 0 | 0 |
| `public.test_sessions` | 0 | 0 | 0 |
| `public.users` | 0 | 0 | 0 |
| `public.waitlist` | 0 | 0 | 0 |
| `public.waitlist_entries` | 0 | 0 | 0 |
| `vecs.docs_collection` | 0 | 0 | 0 |
| `vecs.google-pmle` | 0 | 0 | 0 |

Question statuses remain145 ACTIVE /140 DRAFT /58 RETIRED. Eight newly created
tables initially have zero rows. After all test fixtures clean up, all48 old
counts and all public bank/legacy full-row fingerprints remain unchanged.

## Commands and measured gates

```sh
node scripts/verify-prod-schema.mjs --restore-local \
  --schema /Users/switkowski/Projects/Testero/backups/2026-10-03/schema.sql \
  --bank /Users/switkowski/Projects/Testero/backups/2026-10-03/question-bank-data.sql
node scripts/local.mjs verify-db:prod
node scripts/local.mjs e2e:prod
npm run lint
npm run typecheck
npm test
```

- Automated restore/apply/replay/object/hash/grant check passes (48→56 tables).
- Eight local DB integration groups pass, including actual SQLSTATE42501 calls
  denying the legacy answer writer, RLS/ownership, concurrent quota/claim and
  fulfillment/receipt/refund ordering. Bank fingerprints unchanged.
- Three actual Chromium journeys pass against restored bank. Paid review and
  practice explanations equal the real canonical bank text. No seed substituted.
- 800 unit tests /40 files, lint/types and placeholder production build pass.
- Read-only counts and post-check SQL run locally. Post-check confirms13 v2 RLS
  tables,10 service-only RPCs, browser denial and restrictive ownership gates.
- Schema restoration emitted extension-owned grant warnings, not SQL errors.
  First/second baseline applications emitted only expected already-exists notices.

Evidence: `/tmp/testero-v2-prod-schema-evidence.json`; logs
`/tmp/testero-prod-rehearsal-final.log`, `testero-prod-db-tests.log`,
`testero-prod-browser-tests-ultimate.log`, `testero-prod-unit-final.log`,
`testero-prod-build.log`; actual browser screenshots/traces stay in ignored local
artifacts. No backup content or credentials committed.

## Exact production procedure

See [launch checklist](launch-checklist.md#restore-back-up-then-migrate) for
required backup, target/role/object/count pre-checks and failure/rollback gates.
Human-only approved libpq service (not provisioned or used by this agent):

```sh
PGSERVICE=testero-approved-prod psql -X -v ON_ERROR_STOP=1 --csv -t \
  -f scripts/sql/v2-migration-counts.sql > /approved/secure/location/counts-before.csv
PGSERVICE=testero-approved-prod psql -X -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261003000000_v2_baseline.sql
PGSERVICE=testero-approved-prod psql -X -v ON_ERROR_STOP=1 --csv -t \
  -f scripts/sql/v2-migration-counts.sql > /approved/secure/location/counts-after.csv
PGSERVICE=testero-approved-prod psql -X -v ON_ERROR_STOP=1 \
  -f scripts/sql/v2-migration-postcheck.sql
```

The baseline owns its BEGIN/COMMIT. Compare all PRE-EXISTING table counts; new
v2 tables are additional. Any SQL error before COMMIT rolls back; verify state
before retry. A later post-check error does not undo a successful COMMIT. Keep
traffic gated and obtain approval for a forward fix or reconciled restore. Never
drop old tables, seed production or blindly restore over new users/payments.

## Cleanup

After proof, stop only project `testero-v2` with `supabase stop --no-backup` and
verify no project containers or volumes remain. Frozen preview port3100 and
protected refs/content-pipeline are unchanged. No push, PR or deploy performed.
