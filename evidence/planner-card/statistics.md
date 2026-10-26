# Paired A/B statistics evidence

## Scope and decision

This track changes analysis only. It does not change generation, judges, gates,
doc-check, publisher or production schedule builders. Other tracks add explicitly
opt-in generation features. Experiment A collection remains unchanged by default.

The decision now uses one-sided, equal-weight objective-cluster sign flips on
paired challenger-minus-control accepted outcomes. It can decide only at exactly
80 complete pairs (look 1, alpha .005) or 160 (look 2, alpha .045). Incomplete
pairs and every other prefix, including >160, cannot promote. Re-reading the
same prefix does not create a new look. The two rejection budgets sum to .05;
the union bound does not require independent interim and final results.

Each objective's paired outcomes are reduced to one exact rational mean.
The test flips that mean as a whole. A dynamic program counts the exact
integer-lattice null distribution when the normalized absolute-score sum is
<=20,000 and sum times nonzero clusters is <=2,000,000. Ties are included in the
rejection tail. Zero clusters do not create independent sign evidence. Otherwise,
99,999 independent uniform sign vectors use seed 20261026 and p=(hits+1)/100000;
this prevents a zero p-value. Exact/MC mode, effective clusters and MC seed/draws
are in the report. There are no new package dependencies.

Inference assumes independent objectives, sign-exchangeability of the whole
objective difference under the null, no cross-objective interference, and a
frozen outcome-independent sampling schedule. A zero grand mean alone is not
enough to establish sign-exchangeability. An objective with many pairs still
gets one vote; small cluster counts can make rejection impossible.

The report also has a 95% percentile cluster-bootstrap interval: resample whole
objective means 9,999 times with seed 20261027. It is descriptive, not adjusted
for multiple looks and never used for promotion. With fewer than two clusters,
its endpoints are unknown. A homogeneous observed sample can give a degenerate
bootstrap interval; this does not override the sign-flip decision.

`paired.hoeffding_secondary` preserves the original method, alpha spending,
radius, clipped bounds and legacy yield_improved diagnostic. It adds
`deciding:false`. No Hoeffding number drives the decision. Existing schema
consumers must replace the old `paired.sequential` lookup with this secondary
field or the new `paired.permutation` decision. Numerical legacy checks remain
in the unit tests.

The analysis-side `--schedule` JSON must retain existing experiment/hash/artifact
bindings and `independent_objectives_no_interference:true`, plus:

```json
{"pair_horizon":160,"paired_looks":[{"pairs":80,"alpha":0.005},{"pairs":160,"alpha":0.045}]}
```

These declarations authorize analysis only; no generation configuration is
written. A schedule must be genuinely predeclared, not fabricated after seeing
outcomes. `--alpha` remains available for compatibility but values other than
.05 now fail instead of silently changing the predeclared design.

## Seat guardrails

Summaries retain objective counts and seat-pass counts from observed full-council
rows. On objectives observed in both arms, the one-sided `less` sign-flip test
uses equal-weight differences of within-objective seat pass rates. A seat blocks
when that test gives p<=.05, or the original pooled observed-arm pass rate drops
by >=.10. Significant equal-objective harm can block even if arm pooling hides
it. A non-significant 6pp drop no longer blocks. Missing arm seat rates still
block. If an observed drop below 10pp lacks cluster metadata entirely, promotion
also fails closed for missing evidence; this is a safety exception, not a claim
of statistical harm.

Unmatched objectives are counted, not imputed as passes or failures. With no
common observed objectives the test gives p=1 (no significance evidence); the
10pp point-drop rule still applies. Council reach is selected by upstream gates,
so this is conditional observed-seat evidence, not a causal estimate for skipped
votes. No seat multiplicity adjustment was added (specified alpha .05 per seat).
Canary 100%, factual-defect, human audit, held-out, conditional council and other
existing report guardrails remain unchanged.

## Simulation setup

Command, run in the project's uv environment with no credentials:

```text
env -i PATH="$PATH" HOME="$HOME" CI=true uv run python -m scripts.optimize.simulate_cluster_statistics --trials 2000
```

For each trial: 40 independent objectives, four pairs/objective (160 pairs,
320 candidates). Draw objective propensity p ~ Uniform(.08,.34), so mean control
yield is .21. Conditional on p, draw independent Bernoulli control/challenger
outcomes for four pairs. Under the null both arms use p; under the alternative
challenger uses p+.15. The propensity is shared across outcomes within an
objective, creating arm/outcome dependence within clusters. The interim uses
the first two pairs from every objective (80 pairs). Final uses all four.
Per-trial seeds are 70000..71999 (null) and 90000..91999 (+15pp). All simulated
tests use the production exact helper, with inclusive tails. Outcome data,
not permutation sampling, create the trial-to-trial variation.

| Scenario | Interim .005 | Final .045 | Either predeclared look |
| --- | ---: | ---: | ---: |
| Null | 2/2000 = 0.10% | 59/2000 = 2.95% | 59/2000 = 2.95% |
| +15pp | 496/2000 = 24.80% | 1759/2000 = 87.95% | 1761/2000 = 88.05% |

These are statistical yield-decision rates with all other promotion conditions
assumed clean, not a claim that all safety guardrails pass in 88% of live runs.
The null rate is conservative relative to .05 overall and .045 at final because
binary clustered outcomes have many tied sums. No randomized tie breaking or
mid-p correction was used to increase rejection rates.

Trial Monte Carlo precision (95% Wilson binomial intervals):
- Null either-look false-positive rate: 2.29%–3.79%; standard error ~0.38pp.
- +15pp final power: 86.45%–89.31%; standard error ~0.73pp.
- +15pp either-look power: 86.56%–89.40%; standard error ~0.73pp.

These intervals describe simulation sampling error, not uncertainty in real
production effect sizes. Power depends on within-objective dependence, baseline
yield, treatment heterogeneity and schedule. No universal 88% power guarantee.
Raw results: `statistics-simulation.json`. Reproduction source:
`content-pipeline/scripts/optimize/simulate_cluster_statistics.py`.

## Verification

Focused command:

```text
env -i PATH="$PATH" HOME="$HOME" CI=true uv run pytest -q tests/test_optimize_ab.py tests/test_optimize_evaluate.py tests/test_optimize_cluster_statistics.py
```

Initial focused run: **78 passed, 3 dependency deprecation warnings, 7.62s**.
Subsequent focused result and full concurrent-worktree gate are recorded below
when available. Tests cover brute-force exact-tail agreement, MC determinism,
bootstrap edge cases, equal-objective weighting, repeated reads, all prefix
boundaries, incomplete/duplicate/cross-objective pairs, fixed schedule binding,
legacy Hoeffding arithmetic, one-sided seat significance and 10pp thresholds,
missing metadata and skipped outcomes, canaries, factual defects, and simulated
null/power sanity.

A full gate while other workers are still editing is not the final integrated
gate. The parent owns the final integrated test run.

Completed verification:
- Before follow-up integration: **79 passed, 3 warnings in 8.51s**.
- Concurrent-worktree full gate: **3909 passed, 3 skipped, 25 warnings, 51 subtests passed in 128.95s (0:02:08)**.
- Full output: `statistics-full-tests.txt`; focused output: `statistics-focused-tests.txt`.

## Follow-up: experiment coherence and optional control packs

An explicitly opted-in A+card vs A experiment can carry a nonempty control
pack. Analysis reconstructs assignment with `control_pack_sha256`, requires
`ab_experiment.control_sha256` and root `ab_control_pack.sha256` to agree, checks
both arms' assignment/control hashes and their respective prompt-pack hashes,
and rejects pooling cohorts with different or missing control packs. Reports
emit `control_sha256` only for an explicit control pack. Schedule and human /
held-out audit JSON must bind that same hash. Plain-control artifacts require
no new metadata and remain valid.

Root `plan_freshness_lint` and `scenario_hint_cap` are normalized with absent
meaning false. They must be actual booleans. Analysis rejects mixing cohorts
whose normalized flags differ, even if experiment and pack hash match. Reports
emit the normalized `generation_options` map. The schedule and both audit JSONs
must bind the same map; an omitted map is equivalent to both flags false.
Thus a true-enabled experiment includes, for example:

```json
{"control_sha256":"<64-character control pack hash>",
 "generation_options":{"plan_freshness_lint":true,"scenario_hint_cap":true}}
```

These are analysis-side evidence bindings, not changes to generation defaults.
Unit tests exercise control-aware reports, hash/provenance mismatches, mixed
cohorts, schedule/audit binding, absent-vs-false flags and nonboolean metadata.
The independent reviewer reran the original mixed-flags promotion reproducer;
it now raises rather than promoting.

Latest Part 1 focused result after this follow-up: **91 passed, 3 warnings in
11.00s**. `statistics-focused-tests.txt` contains that completed run. No additional
full gate was started; the parent still owns the final integrated gate.
