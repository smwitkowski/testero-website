# Conversion PR integration checklist

Four independent PRs target `main`; no merge or production action performed by conversion.

- Results: #260, deterministic owned-completed one-question explanation and paid CTA.
- Email: #259, optional explicit-consent aggregate results email and four-week weighted plan.
- Quick-check: #258, 5/10/20 diagnostic lengths.
- Reports: #257, owner-checked durable question feedback.

## Shared paths: reconcile explicitly

1. Combine all four `components/diagnostic-results.tsx` additions. Preserve aggregate-only results, the optional email form, short-session lower-confidence guidance and full20 CTA, and the deterministic free preview.
2. Adapt the results preview CTA's fixed `all 20` text when rendering a 5/10-question diagnostic; the standalone results PR intentionally targets existing20 behavior.
3. Once reports and preview are combined, pass `sessionId={result.sessionId}` and `kind="diagnostic"` into its `QuestionReviewList`; reports review props are intentionally optional for independent PR compatibility.
4. Keep optional length analytics in both `lib/analytics/client.ts` and `lib/analytics/server.ts` while preserving results/preview/unlock events and aggregate-only domain metadata. No email/PII analytics.
5. Keep both additive service-only migrations. Review production migration application after founder-approved merges only.
6. Rerun clean-env unit/lint/typecheck/Docker, local DB verifiers, `qa:local` and the full browser suite on the combined code. Separate-branch passes are not combined-code evidence.

## Human approvals / live checks

- Founder approval before merging; main auto-deploys.
- Coordinator applies reviewed email/report migrations after approved merge. No prod db push/link/reset from conversion.
- Configure Resend via Secret Manager/Cloud Run, verify sender DNS and a live transactional message. Browser submission is mocked; local DB verifier tests persistence/concurrency separately.
- Four-week email plan assumes four hours per week and ends28days from generation; it does not infer the user's exam date. No reminder campaign was added.

Local QA may reset only disposable LOCAL Supabase while holding the shared atomic lease. Child worktrees now live outside `node_modules` with real local dependencies (native Node TypeScript and Turbopack reject the prior nested/symlink setup).
