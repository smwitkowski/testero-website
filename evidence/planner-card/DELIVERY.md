# Planner card delivery

## Changes

- Objective-clustered paired sign-flip yield decision: 80 pairs, alpha .005; 160 pairs, alpha .045. Other prefixes cannot decide. Bootstrap 95% and legacy non-deciding Hoeffding diagnostics remain visible.
- Seat guardrails: one-sided clustered p<=.05 or a point drop>=10pp; canary 100%, factual/audit rules unchanged.
- Offline PMLE doc-reality card builder, opt-in objective-only `lessons`, offline card-pack emitter, and explicit opt-in A control pack for A+card vs A.
- Default-off pre-doc lifecycle/name lint and scenario-hint cap. Judges, gate signatures, publisher, doc-check policies/defaults unchanged. Legacy pack hashes and default A/B assignments verified identical.

## Verification

Required command, run from `content-pipeline`:

```text
env -i PATH="$PATH" HOME="$HOME" CI=true uv run pytest -q
3968 passed, 3 skipped, 25 warnings, 51 subtests passed in 126.81s (0:02:06)
```

Full output: `final-pytest-gate.log`. Independent review: `review.md` (approved, no unresolved blockers).

Simulation: 2,000 seeded trials, 40 objectives x4 pairs, baseline mean 21%, challenger +15pp. Final power 1759/2000=87.95%; either declared look 1761/2000=88.05%. Null either-look false positives 59/2000=2.95% (conservative discrete exact test; Wilson 95% 2.29–3.79%). Full setup/seeds/caveats in `statistics.md` and `statistics-simulation.json`. These measure the yield decision, with other promotion conditions assumed clean; no live gain is claimed.

## Frozen cards

4 PMLE objectives; lengths 245, 203, 392, 294; median 269.5 characters; cap 1200. Canonical frozen source: `content-pipeline/.cache/optimize/cards/pmle-planner-cards-v1.json`. Ready standalone v5 pack: `content-pipeline/.cache/optimize/cards/pmle-card-pack-v1.json`, pack SHA256 `b060718ae85c644d6faf519012507b1b9c40f17d9d3c49c676853b675c5fd59e`.

Six first CLI invocations: four frozen, one authentication failure, one interrupted. No objective retried. Conservative extraction and safety review leave sparse coverage. Original selections preserved; deterministic safety revision required zero model calls and records old/new hashes in `card-safety-revision.json`. The 1.2:3 card is lifecycle-only after dropping an entity-only pseudo-claim. The 5.1:3 lifecycle fact is sourced but may be incidental; no current name was extracted for that objective.

### Required full sample cards

#### `machine-learning-engineer:standard:3.3:2`

```text
Coverage: For proposed TensorFlow single-slice TPU training, the supplied scaling/Multislice pages did not establish the TPUStrategy synchronous-replication claims together with the proposed batch-splitting or gradient-aggregation behavior. Multislice's TensorFlow restriction does not rule out single-slice training.
Lifecycle: No dated lifecycle fact selected.
Current names: Agent Platform
```

#### `machine-learning-engineer:standard:1.2:3`

```text
Coverage: No reliable recurring coverage claim retained.
Lifecycle: imagen-3.0-capability-001 is listed as discontinued; migration deadline 2026-06-30. As of 2026-10-14 (page-923d9e307349f370).
Current names: Imagen; Agent Platform; Model Garden
```

#### `machine-learning-engineer:standard:5.1:3`

```text
Coverage: The docs here do not establish training-only augmentation behavior.
Lifecycle: Feature Store Optimized online serving is deprecated; critical patches only from 2026-05-17; sunset 2027-02-17. As of 2026-10-25 (page-658e16541d9b7027).
Current names: No objective-specific name selected.
```

## Explicit enablement (all generation additions default off)

| Piece | CLI | Nightly JSON |
|---|---|---|
| Cards | `--prompt-pack /absolute/card-pack.json` | `"prompt_pack": "/absolute/card-pack.json"` |
| Interleaving | `--ab-interleaved --ab-experiment NAME` | `"ab_interleaved": true, "ab_experiment": "NAME"` |
| A+card vs A | Emit with `build_card_pack --base-pack /absolute/A.json`; run with `--ab-control-pack /absolute/A.json` | `"ab_control_pack": "/absolute/A.json"` |
| Lifecycle/name lint | `--plan-freshness-lint` | `"plan_freshness_lint": true` |
| Scenario-hint cap | `--scenario-hint-cap` | `"scenario_hint_cap": true` |

Emitter: `uv run python -m scripts.optimize.build_card_pack --cards CARDS --output PACK [--base-pack BASE]`. Builder: `uv run python -m scripts.optimize.build_planner_cards --prepare-only` (offline); remove `--prepare-only` only for authorized first CLI calls. Do not use a stripped authentication environment for the real subscription CLI builder.

Flags apply equally to both arms. Do not enable mid-Experiment A. Cards must stay out of `scope["domain_prompt"]`. Enabled control hashes/options must bind schedule and human/heldout audit JSON; see `content-pipeline/README.md` at Frozen doc-reality cards. Missing/default fields keep old generation behavior.
