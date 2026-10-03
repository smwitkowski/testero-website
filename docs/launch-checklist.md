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

## Restore, back up, then migrate

- [ ] Confirm the correct production project and restore/verify the intended database.
      Inspect existing auth accounts, subscriptions, questions, payments and domain records.
- [ ] Take a `pg_dump` backup of the restored database BEFORE applying the baseline.
      Store it securely, record timestamp/location, and verify a restore into a separate safe database.
      Do not commit backups, database URLs or credentials.
- [ ] Review and explicitly approve `supabase/migrations/20261003000000_v2_baseline.sql`.
      Apply only to the approved target. Do not replay `migrations_legacy` or load local seed in production.
- [ ] Verify RLS, confirmed auth, RPC grants, quotas, pass/refund/receipt state and existing legacy access.

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
