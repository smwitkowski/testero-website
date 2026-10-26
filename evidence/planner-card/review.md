# Independent implementation review

Historical review of statistics, guardrails, packs, lifecycle/hints, CLI/nightly and resume found two blocking defects. Both were fixed before the initial push:

1. Explicit `--ab-control-pack` now compares A+card versus A, not plain versus A+card. Control hashes bind assignment/report/schedule/audits. Generator transport tests prove each writer receives its arm pack while docs/proof/judges receive no pack prose.
2. Reporting rejects pooled artifacts with different planner-option fingerprints. Absent and false remain equivalent; nonboolean flags and mismatched control provenance fail closed. The former mixed-cohort promotion reproduction now raises ValueError.

Focused reruns: 188 control/check tests and 91 statistics tests passed. No unresolved arithmetic finding in equal-weight objective sign flips, fixed looks, bootstrap, or seat guardrails. Original products remain unchanged; new planner facts are separate/default-off. Forty legacy assignment parity scenarios retained identical defaults.

The initial four-card review exposed entity-only pseudo-claims and lost compound TPU context. Deterministic corrections removed the former and restored single-slice/Multislice scope. These lessons now constrain full-span semantic extraction; the initial four-card counts are not the final expanded build.

Current full-eligibility and new-card source review is in `revision-review.md`. Final gate and runtime hashes/counts are in `DELIVERY.md`. This is review evidence, not approval to enable generation features or promote an arm. Direct frozen-plan callers outside the batch wrapper remain a possible future policy-binding improvement, not part of this task.
