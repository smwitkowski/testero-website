# Paired A/B inference

Analysis only. Generation, judges, doc-check policies, and publishing gates are unchanged.

## Yield rule

Reduce paired challenger-minus-control accepted outcomes to one exact rational mean per objective. Give objectives equal weight. One-sided sign flips can decide only at **80 complete pairs (alpha .005)** or **160 complete pairs (alpha .045)**. Other prefixes and incomplete pairs cannot promote. The rejection budgets sum to .05. Schedule JSON must declare the horizon/looks and existing experiment/hash/artifact/independence bindings.

The exact lattice dynamic program includes ties. Large irregular lattices use 99,999 sign draws, seed 20261026, with `(hits+1)/100000`. The descriptive percentile bootstrap resamples whole objective means 9,999 times, seed 20261027. Fewer than two clusters gives unknown endpoints. Legacy Hoeffding values remain non-deciding secondary fields.

Assumptions: independent sign-exchangeable objective differences, no cross-objective interference, frozen outcome-independent sampling. A zero grand mean alone does not prove sign-exchangeability. The bootstrap interval is not sequentially adjusted and never decides promotion.

## Seat guardrails and experiment binding

For common observed objectives, test equal-weight within-objective seat-rate differences one-sided (`less`). Block at p<=.05 or a pooled point drop>=10pp. Missing cluster metadata for an observed smaller drop fails closed. Significant objective-weighted harm can block even if pooling hides it. Skipped/unmatched votes are not imputed. Canary 100%, factual-defect, human/heldout audit and other prior guardrails remain unchanged.

Optional control hashes must agree in root metadata, assignments, schedule and audits. Planner flags normalize absent to false, require booleans, and cannot differ across pooled artifacts. Enabled `generation_options` must match schedule/human/heldout audits.

## Reproducible simulation

`uv run python -m scripts.optimize.simulate_cluster_statistics --trials 2000`

40 objectives x4 pairs. Per-objective p~Uniform(.08,.34), mean control yield 21%; independent arm Bernoullis conditional on shared p. Challenger uses p under null or p+.15. Interim uses two pairs/objective; final four. Null seeds70000..71999, alternative90000..91999.

| Scenario | Interim | Final | Either look |
|---|---:|---:|---:|
| Null |2/2000=.10%|59/2000=2.95%|59/2000=2.95%|
|+15pp|496/2000=24.80%|1759/2000=87.95%|1761/2000=88.05%|

Null either-look Wilson 95% 2.29–3.79%; +15pp either-look 86.56–89.40%. Exact tied binary sums make this conservative. These are yield-test rates assuming other safety conditions clean, not live promotion guarantees. Raw small summary: `statistics-simulation.json`.

Focused statistics tests passed 91. Latest complete clean-env gate is recorded in `DELIVERY.md`; raw logs remain local, not committed.
