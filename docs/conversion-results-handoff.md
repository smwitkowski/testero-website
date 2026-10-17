# Conversion results handoff

PR: https://github.com/smwitkowski/testero-website/pull/260
Commit: 3f84c9b (implementation).

## Verified
Clean-env npm test: 59 files / 1073 tests pass. Clean-env lint and typecheck pass, including final reruns after e2e additions. Docker build exit0; image sha256:66735e59ff232626ccb1b4450279bf85b5efdfa6609787f17988c9099e496be6. Existing Dockerfile build-placeholder SUPABASE_SERVICE_ROLE_KEY triggers Docker SecretsUsedInArgOrEnv warning (no actual credential supplied).

`npm run qa:local` failed before browser tests: local migration history contains 20261017190000 absent from this checkout. No repair/reset attempted. Browser assertions are written but unexecuted. Another top-level workstream is actively using shared local DB; coordinate exclusive lease before any DB/flow commands.

## Security
GET /api/diagnostic/[sessionId]/free-explanation uses the existing server-verified owner cookie/account. Completed sessions only. Server selects lowest exact-accuracy domain, stable exam-guide tie order; first miss in that domain or first item on a perfect run. Loader receives one item. Every option rationale required; unavailable content fails closed without substituting another item. No query selector accepted. Aggregate anonymous results/answer APIs unchanged. Cache-Control private,no-store.

## Integration
Separate PRs: reports #257, quick checks #258, transactional email #259. All target main; no merges performed.
- Reconcile components/diagnostic-results.tsx so all four additions survive.
- Reports extends QuestionReviewList with sessionId and kind. Supply `sessionId={result.sessionId} kind="diagnostic"` to the free preview's QuestionReviewList after both branches combine. Otherwise that new question view lacks reporting.
- Quick-check changes selection/creation and analytics/client + server. Preserve length and results analytics.
- Adapt the exact all20 upgrade CTA for short diagnostics (all5/all10) after combining; this branch intentionally uses the user-requested full20 text.
- Rerun all gates on combined code, including diagnostic e2e and qa:local. Added diagnostic preview assertions live in e2e/diagnostic.spec.ts; qa:local runs e2e/qa-core.spec.ts only.

## Production
This track needs no migration, new env var or dependency. Coordinator applies reviewed reports/email migrations only after founder approval. Configure RESEND_API_KEY from Secret Manager and validate sender DNS/delivery; no live Resend evidence yet. Reminder email omitted. No production changes, approval or metrics improvement claimed.
