# Multi-cert beta diagnostics

Beta diagnostics test demand. They do not unlock paid or free practice for other exams.
PMLE diagnostics, pricing and practice keep their existing behavior.

## Deploy

1. Apply `supabase/migrations/20261021190000_multi_cert_beta_diagnostics.sql` through the approved migration process before serving this app version.
2. Set the **server-only runtime** environment variable `BETA_DIAGNOSTIC_CERTS` to a comma-separated subset of:

   ```text
   data-engineer,cloud-architect,cloud-engineer,generative-ai-leader,agentic-architect
   ```

   Empty or unset disables all beta diagnostics. This is not a `NEXT_PUBLIC_` variable and does not need a browser build argument.
3. A listed cert also needs at least 20 questions for its exact exam ID with `status = ACTIVE`, `review_status = GOOD`, `parent_question_id IS NULL`, and `question_type = single_select`. Drafts, retired questions and variants do not count.
4. Check `/certifications/<cert-id>` and `/diagnostic?cert=<cert-id>`. Enabled pages show the free beta diagnostic CTA. Disabled or under-threshold diagnostics return 404; their cert page keeps its existing notify form.

Beta diagnostics offer only 5 or 10 questions. The server samples the selected cert's sections using its standard guide weights. The database rechecks inventory, eligibility and exam identity at session creation. Changing the allowlist does not convert practice to multi-cert.

## Results and analytics

Beta results show a readiness tier and a practice-notification waitlist. They do not show question review, explanations, results email, pricing, checkout or a PMLE Pass offer. Results email is PMLE-specific, so beta email requests are blocked on the server as well as hidden in the UI.

Diagnostic started/completed/question-answered events include the public certification slug as `cert_id`. PMLE uses `machine-learning-engineer`. Existing event names and internal-traffic exclusion remain unchanged. The existing `cert_waitlist_joined` event and `cert_waitlist` storage handle beta practice notifications.

## Local checks

Run all commands from this worktree in a clean environment:

```sh
env -i PATH="$PATH" HOME="$HOME" CI=true npm test
env -i PATH="$PATH" HOME="$HOME" CI=true npm run lint
env -i PATH="$PATH" HOME="$HOME" CI=true npm run typecheck
env -i PATH="$PATH" HOME="$HOME" CI=true docker build .
env -i PATH="$PATH" HOME="$HOME" CI=true npm run test:db:local
```

Acquire the shared local QA lease before local Supabase or browser checks. Reset **local only** to this branch's migrations as needed. Do not use a linked database or production credentials.

## Review capture note

`hq/tools/review-capture.mjs` is outside this worktree and was not edited. The coordinator should add a beta start screen (`/diagnostic?cert=data-engineer`) and a completed beta results screen, with `BETA_DIAGNOSTIC_CERTS=data-engineer` and at least 20 eligible local fixture questions. Capture the tier, practice-coming-soon message and waitlist, and verify there is no commerce or results-email CTA.
