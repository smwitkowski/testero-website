# Matched full-suite baseline — 2026-10-23

## Conclusion

All three previously timed-out cases passed on both `origin/main` and the PR branch in matched fresh-cache full-suite runs. No regression reproduced, so no runtime or test timeout change was made. These results do **not** establish that the earlier failures were pre-existing on main.

| Test | Main `8231d73` | PR `1024acd` | Finding |
| --- | --- | --- | --- |
| `e2e/accounts-practice.spec.ts:49` — local account confirmation claims only owned diagnostics, practices five, and blocks further free starts | Pass, 42.9 s | Pass, 33.4 s | Prior timeout not reproduced |
| `e2e/auth-email.spec.ts:50` — confirm and reset links work in another browser; unconfirmed sign-in and expired links offer a new email | Pass, 13.0 s | Pass, 13.6 s | Prior timeout not reproduced |
| `e2e/free-tier-monthly.spec.ts:36` — monthly free questions: fresh, 59→60 concurrent boundary, paid tracking and refund | Pass, 9.2 s | Pass, 15.7 s | Prior timeout not reproduced |

Durations above are whole-test durations, not individual assertion or request latency. All three complete test sources are unchanged between main and the PR. Source identity alone is not evidence of a pre-existing runtime failure.

## Full-suite outcomes

- Main: **exit 0, 14 passed, 16 skipped**, 2.3 minutes.
- PR: **exit 0, 19 passed, 16 skipped**, 2.3 minutes. The five extra enabled cases are the new paid-landing cases, including the exact Google ad-checker UA.
- The same 16 existing opt-in tests were skipped in both runs. Skipped cases are not validated by this comparison.

## Reproduction and mode

The historical PR **full-suite** run used a fresh Next **development** cache. Only the separate focused paid-landing suite used an optimized build. This baseline matches the actual full-suite command and environment; it is **not** an optimized-production full-suite comparison.

1. Fetch `origin/main`, then `git worktree add ../frontend.baseline-main origin/main` (detached commit `8231d73125ab57ca937e33915116f2e3242e9140`).
2. Run `npm ci` in that checkout. Confirm `.next` does not exist.
3. Run the exact command below. Wait for completion and verify the local server and Stripe fixture stop.
4. In the PR checkout at `1024acd40962f3e16d87a4c9fd514bb241ed71b7`, remove only its generated `.next`, run `npm ci`, then run the same command. No builds, unit tests or other browser suites ran concurrently.
5. Restore only the two Next-generated `next-env.d.ts` dev import changes, then remove the baseline worktree.

```sh
env -i PATH="$PATH" HOME="$HOME" CI=true npm run test:e2e:local
```

Both runs used Node `v22.23.4`, npm `10.9.9`, the same machine and PATH/HOME, one Playwright worker, zero retries, the local `testero-v2` Supabase project, loopback-only APIs, local Stripe fixtures, and disabled public PostHog configuration. `scripts/local.mjs` supplies CLI-generated local credentials in process memory; no `.env` file was read or written. No production writes, merge or deploy occurred.

The runner starts `npm run dev` via the unchanged Playwright config. Its `e2e:prod` mode refers to production-schema parity, not Next production serving. The optimized-build paid-only result (5/5 passed) remains separate in `optimized-paid-browser-output.txt`.

## Evidence history

The earlier 15-pass/16-skip/3-timeout run remains in `browser-run-history.txt` and `gates.json`. It was not relabeled as passing or proven pre-existing. The paired raw outputs were inspected after each command completed; no traces, cookies, credential values, or network objects are included here.
