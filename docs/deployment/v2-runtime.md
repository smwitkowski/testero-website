# Testero v2 runtime and CI configuration

This is a configuration reference, not approval to deploy. No remote service was
called during implementation. The founder's launch checklist owns database
restoration, legal approval, no-traffic QA, traffic changes, and merge approval.

## Eight application variables

`.env.example` contains only local placeholders for these eight values. Real
credentials come from the process environment. Do not write or commit an env file
with real keys.

| App variable | Docker build | Cloud Run runtime |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Build argument | Environment value |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build argument | Environment value |
| `SUPABASE_SERVICE_ROLE_KEY` | Fake build placeholder only | Secret Manager binding |
| `NEXT_PUBLIC_POSTHOG_KEY` | Build argument, optional | Environment value, optional |
| `NEXT_PUBLIC_POSTHOG_HOST` | Build argument, optional | Environment value, optional |
| `STRIPE_SECRET_KEY` | Never supplied | Secret Manager binding |
| `STRIPE_WEBHOOK_SECRET` | Never supplied | Secret Manager binding |
| `STRIPE_PRICE_PMLE_PASS` | Not needed | Environment value |

Public values are compiled into the browser bundle. Runtime-only changes to those
values do not change an existing browser bundle; rebuild the image. Leave both
PostHog values empty to disable analytics. Use the Supabase project that holds the
approved restored data. Use matching Stripe test/live key, price, and endpoint
signing secret. The price is the one-time US $39 PMLE Pass, not a recurring price.

`NODE_ENV=production` is set by Docker and the deployment platform. It is not a user
secret. `TESTERO_LOCAL_STRIPE` is a local test-runner flag, not production config.
There is no application `SITE_URL` or `PRODUCTION_URL` variable. Canonical SEO uses
the fixed origin `https://testero.ai`.

## Exact GitHub Actions configuration

Configure these **repository secrets** (the jobs do not select a GitHub Environment) for deployment:

| GitHub secret | Value |
| --- | --- |
| `GCP_SA_KEY` | JSON credential for the approved deployment service account |
| `GCP_PROJECT_ID` | Cloud project ID |
| `GCP_REGION` | Existing service/Artifact Registry region |
| `ARTIFACT_REPOSITORY` | Existing Artifact Registry repository name |
| `SERVICE_NAME` | Existing Cloud Run service name |
| `NEXT_PUBLIC_SUPABASE_URL` | Public project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key; never the service-role key |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional public project key, or unset |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional public ingestion host, or unset |
| `STRIPE_PRICE_PMLE_PASS` | Matching one-time `price_...` ID |
| `SUPABASE_SERVICE_ROLE_KEY_SECRET` | Secret Manager `name:version` reference |
| `STRIPE_SECRET_KEY_SECRET` | Secret Manager `name:version` reference |
| `STRIPE_WEBHOOK_SECRET_SECRET` | Secret Manager `name:version` reference |

The three `_SECRET` values are references, **not raw keys**. Example references:
`testero-supabase-service-role:1`, `testero-stripe-key:1`, and
`testero-stripe-webhook:1`. Use actual existing names and numeric versions. The
workflow also accepts `latest`, but numeric versions make rotation and rollback
explicit. References resolve in the deployment project. Raw service-role and
Stripe credentials belong only in Secret Manager secret versions, not build args,
GitHub-generated env files, browser variables, or image layers. Older notes that
suggest raw GitHub `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or
`STRIPE_WEBHOOK_SECRET` values do not describe this v2 deployment workflow.

Configure **GitHub Actions variable `PRODUCTION_URL`** as the approved production
HTTPS origin (for example `https://testero.ai`, no path/query/credentials). The
keep-alive job accepts a GitHub secret of the same name only as a fallback. This is
workflow configuration, not an app env var or Docker build argument. Do not point
it at an unapproved preview or another service.

## Cloud Run secret bindings and IAM

The workflow maps these runtime environment names:

| Cloud Run name | GitHub reference source |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY_SECRET` |
| `STRIPE_SECRET_KEY` | `STRIPE_SECRET_KEY_SECRET` |
| `STRIPE_WEBHOOK_SECRET` | `STRIPE_WEBHOOK_SECRET_SECRET` |

Before an approved deployment, the founder must provision/verify the referenced
secret versions and the existing runtime service identity. Grant that **runtime
service account** `roles/secretmanager.secretAccessor` on each required secret.
The GitHub deployment account needs the approved Cloud Run deployment permission
(`roles/run.admin` for the existing unauthenticated-service setting),
`roles/iam.serviceAccountUser` on that runtime account, `roles/iam.serviceAccountTokenCreator` on **itself** (the build job's `token_format: access_token` login mints a token for the deployer account), and
`roles/artifactregistry.writer` on the target repository. Use resource-scoped grants
where supported. Keep the existing Cloud Run service agent's image-read access.
Do not replace the runtime service account or broaden project-wide access just to
fix a missing secret permission. Credential rotation is a founder action.

`deploy-cloudrun@v2` explicitly uses `env_vars_update_strategy: merge` and
`secrets_update_strategy: merge`. It updates only listed values/bindings and
preserves unrelated existing env values and secret bindings. It does not use a
wiping environment replacement or generate an env file containing raw secrets.
Known obsolete settings need a separate approved cleanup; merge does not remove
them. Both optional PostHog values are listed, so empty values intentionally disable
analytics. Verify env/secret binding state after any approved migration or rotation.

## Image and CI behavior

Pull requests to `main` run lint, typecheck, unit tests, and a Next.js build with
fake local server credentials and disabled PostHog. Only pushes to `main`, after
quality checks succeed, push an image and deploy. Manual CI dispatch runs quality
checks only. PR checks never authenticate to Google or contact production.

The Node 22 image uses standalone Next.js output and a non-root `nextjs` user.
Public files, `.next/static`, and **`content/` are copied explicitly into the
runner**. This includes blog/FAQ Markdown, the catalog, and legal Markdown under
`content/legal/`. Next.js output tracing also includes `./content/**/*`.
`.dockerignore` excludes real env files, `.git`, `content-pipeline/`, Supabase,
end-to-end fixtures/results, and docs; it must not exclude `content/`. No pipeline runtime or outside-repo
`hq/drafts/` file is copied. Copying legal Markdown does not approve it: the legal
renderer and founder approval gate still decide whether it is publishable.

## Public health and daily keep-alive

`GET /api/health` requires no session or token. Every request creates a server-only
service client and reads only `exam_domains.select("id").limit(1)`, with a five-second
abort signal. A successful read, even an empty table, returns HTTP **200** and
exactly `{"ok":true}`. A database error, timeout, thrown error, or missing server
configuration returns HTTP **503** and exactly `{"ok":false}`. Both responses set
`Cache-Control: no-store`. No rows, user data, env values, auth tokens, or error
messages are returned. This proves basic DB reachability, not question-bank
coverage, Stripe setup, or founder approval. Keep this route outside proxy auth.

The keep-alive workflow runs daily at **08:17 UTC** and supports manual dispatch.
It performs one GET to the configured production origin's `/api/health`, with a
20-second request timeout and a two-minute job limit. Redirects are rejected. The
job requires HTTP 200, JSON content type, and exactly `{"ok":true}`. Missing URL,
HTTP failures, timeout, invalid JSON, false health, or extra response keys fail the
job loudly; no failure suppression is used. Enable workflow-failure notifications
for the founder. A health check does not promise that a free-tier database cannot
pause; if it fails, investigate the approved database/runtime configuration.

Implementation checks are local unit/static tests only. The production health
workflow, Docker image build/push, and Cloud Run deployment were not executed as
part of this phase.
