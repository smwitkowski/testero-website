# Pipeline v6 fix 2 verification

## Scope
- Add explicit Resend User-Agent; retain NoRedirect and 30-second timeout.
- Retry only failed frozen health system calls, up to two additional attempts.
- Keep quality verdicts unchanged. Keep canary errors and safety failures hard.
- Allow exhausted gold system errors to reach evaluation; page incomplete gold and continue generation/publication.
- Correct Argon schema failure labels without logging provider exception bodies.

## Verification
- Baseline focused suite: 179 passed (`baseline-pytest.log`).
- Focused replay suite before timeout variant: 192 passed (`focused-pytest.log`).
- `env -i PATH="$PATH" HOME="$HOME" CI=true npm test`: 109 files, 1952 tests passed (`app-test.log`).
- Clean-env `npm run lint` and `npm run typecheck`: exit 0 (`app-lint.log`, `app-typecheck.log`).
- `docker build -t testero-v6-fix2-local .`: exit 0 (`docker-build.log`). Existing Dockerfile placeholder-key warning remains unchanged.
- Full pipeline pytest: 3256 passed, 3 skipped, 25 warnings, 51 subtests passed in 104.32s (0:01:44) (`full-pytest.log`).
- Independent review approved; original adversarial probe plus focused tests: 110 passed (`review-rerun-pytest.log`). A stale-record persistence bug found during review was fixed with a current-result latch and three regressions.

All new model/provider/mail/DB behavior tests use synthetic or frozen local replay. No live API, paid model, production DB write or real email was used. No `.env` file was read. Docker uses its existing local placeholders; no credentials were supplied.

## Publication
PR targets main; never merge. Local validation and independent review passed.
