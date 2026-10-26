# Planner-card delivery — PR #317

Opt-in analysis/planner changes only. No running Experiment A change, production writes, publisher/judge/gate changes, or OpenRouter/Exa/Gemini calls. Do not enable features mid-experiment.

## Full PMLE card revision

Eligibility means at least three distinct pre-cutoff vetoed candidates, not a lexical claim match. An independent parser confirmed all 50 eligible objectives and their source bindings. Filtered inputs contain 52 objectives with vetoes, 384 distinct candidates, and 859 reasons. Of 86 input artifacts, 82 were kept, one was excluded by tag/A/B metadata, and three by cutoff. No canary/gold items were found in the authorized inputs. Separately stored held-outs need explicit exclusions.

Every eligible objective has a card, a no-card reason, or an exhausted-retry failure. Subscription Claude CLI calls run serially, with at most three tries per objective. Retry waits are 30 and 60 seconds. The recorded terminal backoff cap is 120 seconds; there is no pointless wait or fourth call. Persisted attempts consume interrupted calls and preserve outcomes. Frozen audit bytes cannot be overwritten by a changed-input resume. Diagnostics use static enums and bounded technical selections, not raw provider envelopes or arbitrary error text.

Original CLI outcomes: 32 proposals, 2 no-card, 16 exhausted; 94 attempts, maximum 3 per objective. Final source-reviewed freeze: **32 cards, 11 no-card, 7 unrecovered; median 315 characters (170–700)**. Eight unsafe proposals became no-card. Nine captured failures were resolved offline: eight cards and one no-card. No extra calls were made. Seven early failures retain only generic source/format lint diagnostics. All 32 retained cards received full-source review. Three additional random samples passed an independent review.

Final counts, per-objective outcomes and three additional random cards: `cards.md`. Independent full-source review: `revision-review.md`. Detailed audit, attempts and raw test logs stay local under ignored `.cache/optimize/cards-revision/`, not git.

## Runtime files (outside git)

`/Users/switkowski/Projects/Testero/hq/pipeline-nightly-runtime/packs/`:

- `pmle-planner-cards-v1.json` — file SHA256 `4b491a7ff576451dccf43f5e3d4a76537f264adc70a8b8d3fb760e1c5599cdd1`
- `pmle-card-pack-v1.json` — normalized pack hash `7a12f3ebdc28f9e716b435b1bdd5be8c3dfcbdd530ff84ac57c5717f83ac2dc1`
- Base `zero-cost-pmle-v5.json` — normalized pack hash `c3d59c51f30a1ad3777ecfd6e39056e368b579727f88cce7777ef0d9f5dd2af4` (unchanged)

Pack construction adds lessons to the real A base; it does not substitute a synthetic v5 pack. Use explicit `--ab-control-pack` for A+card versus A. Runtime files are not committed or force-added under ignored paths.

## Verification

Required gate: `cd content-pipeline && env -i PATH="$PATH" HOME="$HOME" CI=true uv run pytest -q`.

**3,994 passed, 3 skipped, 25 warnings, 51 subtests in 120.05s; exit 0.** Builder/test SHA256s remained unchanged after the run. Focused card tests: 55 passed. Offline emitter/runtime verification passed: all 32 cards pass lint, hashes and provenance checks; lessons equal frozen text; base writer/policy fields are unchanged except the added lessons/provenance; normalized pack/card hashes match. The base file SHA256 stayed `3a139c91fdd6f3c109ecec1a5c8122bb54b866d6077e55fcfbee477762b4bb52`. Current CI status is reported on PR #317.

Compact evidence retains 40 unchanged legacy assignment parity scenarios and pack hash/render compatibility. The objective-cluster sign-flip looks remain 80/160 pairs, with alpha .005/.045. In 2,000 trials, +15pp power was 87.95% at final and 88.05% at either look; the null either-look rate was 2.95%. These 40 simulation/parity objectives are not the 50 eligible card objectives. See `statistics.md`, `statistics-simulation.json`, and `planner-checks.md`.

Default-off flags, optional lessons omission and legacy hashes preserve unmodified commands. Cards enter writer instructions only, never domain_prompt or documentation-check inputs. No merge or auto-merge was requested.
