# Founder launch checklist — Testero v2

**Not launch-approved by local tests.** No remote action below has been run.
Use [runtime setup](deployment/v2-runtime.md) and [Stripe setup](deployment/stripe-setup.md).
The main workflow deploys on push: configure and review its target before merging.

## Before a PR to main

- [ ] Approve product copy, $39/90-day/no-auto-renew/7-day-refund terms and support process.
- [ ] Publish approved legal text in `content/legal/terms.md` and `privacy.md`,
      each with literal `approved: true`. Placeholders block launch. Never use `hq/drafts` automatically.
- [ ] Review the additive baseline, existing table compatibility/RLS/RPC privileges
      and data ownership. Review migration against the actual restored schema, not only the seed.
- [ ] Review Phase 4 proof and final diff. Confirm original blogs/pipeline/frozen preview unchanged.
- [ ] Configure GitHub's 11 required and 2 optional PostHog secrets and `vars.PRODUCTION_URL` as documented;
      references ending `_SECRET` are Secret Manager `name:version`, not private values.
      Grant the Cloud Run runtime account Secret Manager accessor. Review service/region/project.
- [ ] Review deployment merge behavior, public build arguments, runtime-only keys,
      minimum instances, health keep-alive, Supabase email URLs and production DNS.
- [ ] Prepare a reviewed PR from `prime/v2` to `main`; run CI. Do not merge until
      backup, migration, payment QA and no-traffic revision plans are approved.


> **Status 2026-10-04:** the v2 baseline was applied to production, and the counts and post-check passed. Because it revoked browser-role access, which the OLD app relies on, interim read-only `interim_old_app_read` policies plus SELECT grants were added on questions, answers, explanations, and exam_domains. **After v2 serves traffic, run `scripts/sql/v2-cutover-lockdown.sql`** (as `postgres`) to remove them.

## Restore, back up, then migrate

The 2026-10-03 non-PII schema/bank rehearsal is in
[`v2-prod-schema-verification.md`](v2-prod-schema-verification.md). It is not
approval to connect to production or apply SQL. Never read/load `data.sql` or
`roles.sql` in this local procedure. Legacy/user data and production role
memberships were not restored; the founder must check those on the real target.

### Local preflight with the approved two-file backup

```sh
supabase start
node scripts/verify-prod-schema.mjs --restore-local \
  --schema /Users/switkowski/Projects/Testero/backups/2026-10-03/schema.sql \
  --bank /Users/switkowski/Projects/Testero/backups/2026-10-03/question-bank-data.sql
node scripts/local.mjs verify-db:prod
node scripts/local.mjs e2e:prod
```

`--restore-local` destroys ONLY isolated local public/archive/vecs/vector schemas
on port56542. No local seed is loaded. The script checks full-row fingerprints,
all existing object identities/definitions, RLS/grants and logical replay.
The verifier whitelists the two exact 2026-10-03 backup paths, including
symlink targets. A different backup directory requires explicit approval and a
reviewed whitelist update. Record both backup SHA256s and the exact reviewed
baseline commit/hash. If the
backup/schema/inventory changes, take a new approved non-PII backup and repeat;
do not bypass failed counts or load user/role dumps to make a test pass.

### Human-only production pre-check

- [ ] Verify the approved target, database/user/server version and connection
      privileges. Stop conflicting writes for a coordinated maintenance/cutover
      window. The baseline tightens canonical browser grants and disables the
      browser answer-upsert RPC; approve impact on old-app/admin clients first.
- [ ] Take a fresh `pg_dump` backup BEFORE apply. Store it securely and verify
      restoration in a separate approved database. Never commit/read a user backup
      as part of these local checks. Record backup location and rollback approver.
- [ ] Use an approved libpq service named `testero-approved-prod` provisioned by
      the founder (not this agent). Do not place credentials in shell history,
      command arguments, Git, logs or `.env.example`.
- [ ] Record every existing public/archive/vecs/vector table count, including all
      legacy/user tables, using the read-only command below. Record bank status
      totals 145 ACTIVE / 140 DRAFT / 58 RETIRED. Current bank counts must be
      domains29 / runs165 / questions343 / answers1372 / explanations343.
      Any difference requires a fresh rehearsal, not blind application.
- [ ] Confirm all eight v2 tables are absent on the first apply: user_subscriptions,
      payment_history, webhook_events, pmle_passes, pmle_pass_refunds,
      study_sessions, session_items, free_practice_quota. If any exist, review
      their structures/data/functions/policies against the rehearsed target.
      Existing legacy subscriptions are not automatically copied into
      user_subscriptions; decide any legacy-entitlement mapping before launch.
- [ ] Review current grants/role memberships, all five existing application RPC
      definitions, seven matching index names and policy names. Unknown collisions
      or privileged role inheritance require review before apply.

```sh
PGSERVICE=testero-approved-prod psql -X -v ON_ERROR_STOP=1 --csv -t \
  -f scripts/sql/v2-migration-counts.sql > /approved/secure/location/counts-before.csv
```

The output contains counts only, not user rows. Use an actual secure location.
Do not replay `migrations_legacy`, load local seed, run the destructive local
restore script against production, or use Supabase link/db push for this step.

### Exact approved apply and post-check

The baseline already contains `BEGIN`/`COMMIT`. Apply the reviewed file once:

```sh
PGSERVICE=testero-approved-prod psql -X -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261003000000_v2_baseline.sql
PGSERVICE=testero-approved-prod psql -X -v ON_ERROR_STOP=1 --csv -t \
  -f scripts/sql/v2-migration-counts.sql > /approved/secure/location/counts-after.csv
PGSERVICE=testero-approved-prod psql -X -v ON_ERROR_STOP=1 \
  -f scripts/sql/v2-migration-postcheck.sql
```

- [ ] Compare EVERY pre-existing table count with its before value; the eight
      new tables start empty. Verify bank counts/status totals and reviewed
      eligibility143, domain supply27/27/28/17/27/17. Do not mistake empty local
      legacy fixtures for verified production legacy counts.
- [ ] Confirm canonical content is service-only, all13 v2 tables have RLS,
      authenticated metadata has restrictive ownership gates, all10 v2 RPCs
      deny browser execution, and existing upsert_question_answers is denied
      to PUBLIC/anon/authenticated but still allowed to service_role.
- [ ] Preserve old tables/columns/indexes/triggers and legacy RPC/policy definitions.
      Review pre-existing legacy quota/progress exposure separately; this migration
      does not silently redesign those legacy contracts.
- [ ] Reload PostgREST schema if needed, then run approved no-traffic product QA.
      Review absence of user_subscriptions in the backup before assuming old
      subscription customers have v2 legacy access. Record migration evidence.

### On failure

Stop on any nonzero exit. Do not promote or blindly retry. The baseline transaction
rolls back an SQL failure before COMMIT; verify transaction/object state and
unchanged pre-existing counts before deciding the next step. A successful COMMIT
followed by a failed post-check is NOT an automatic rollback. Keep traffic gated,
inspect grants/role inheritance/count differences, and obtain approval for a
forward fix or restoration/reconciliation. Never drop preserved tables to force
compatibility or restore over new accounts/payments without a reconciliation plan.
A repeated apply is logically idempotent, but rerun in production only after review.

## Stripe and no-traffic revision

- [ ] Create/review the one-time $39 USD PMLE Pass product/price. Set server-only price ID.
      Bind service-role key, Stripe secret key and webhook secret through Secret Manager.
- [ ] **Plain value → secret conversion.** The old app's service has `SUPABASE_SERVICE_ROLE_KEY` and
      `STRIPE_SECRET_KEY` as plain env values. Cloud Run rejects a name that is both a plain value and a
      secret, so the first workflow deploy would fail. In the manual **no-traffic** candidate deploy,
      remove the plain values and bind the secrets in the same revision
      (`--remove-env-vars SUPABASE_SERVICE_ROLE_KEY,STRIPE_SECRET_KEY` plus `--update-secrets …`).
      Verify the candidate's settings afterwards. Old revisions keep their own settings, so live traffic
      is unaffected. Never run `--remove-env-vars` alone on the live service, because that rolls out an
      old-app revision without its keys. `STRIPE_WEBHOOK_SECRET` is already a Secret Manager
      reference; point `STRIPE_WEBHOOK_SECRET_SECRET` at that same secret.
- [ ] Configure the exact signed webhook events in Stripe setup. Align test/live keys,
      price and webhook secret. Validate currency/amount. Review support/refund procedure.
- [ ] Build and deploy a candidate Cloud Run revision with **no traffic** using an
      explicitly reviewed manual procedure. The committed main workflow does not provide
      an automatic no-traffic gate. Keep the current serving revision recorded.
- [ ] On the candidate URL: test anonymous diagnostic/ownership, signup/email confirmation,
      claim, login/logout/recovery, dashboard, five free questions and quota reset/resume.
- [ ] In Stripe **test mode**, verify checkout, processing-before-webhook, signed payment,
      paid explanations, extra practice sessions, duplicate delivery, refund/replay redaction,
      refunded receipts, duplicate-charge prevention and active legacy portal.
      Local fake fixtures do not satisfy this gate. Keep test data separate from live accounts.
- [ ] Test public pages/legal/SEO, all legacy URL families, HTTP health and the manual keep-alive.
      Confirm analytics omits PII and server keys never enter image layers or browser bundles.

## Promote and monitor

- [ ] Approve the candidate, migration and payment QA evidence. Merge the reviewed PR
      only with the main deployment behavior understood; promote the approved revision deliberately.
- [ ] Watch Cloud Run errors, Supabase/Auth availability, health action failures,
      Stripe webhook retries/refunds and checkout conversion. Verify the production URL after cutover.
- [ ] Record revision/image digest, migration state, approver and backup in the release log.

## Roll back

- [ ] Route traffic to the recorded last good revision if errors or access/payment failures appear.
      Stop risky checkout paths, inspect webhook retry state, and reconcile receipts/refunds.
- [ ] Do not drop additive schema or restore over new payments/accounts without a reviewed
      reconciliation plan. A code rollback is not a database rollback.
- [ ] Restore the verified backup only with explicit approval and a plan to preserve
      post-backup financial/auth data. Recheck health, RLS, legacy access and payment state.
