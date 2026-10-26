# Opt-in planner lifecycle and scenario checks

## Enabling

The generation CLI (`scripts/generate_pmle_questions.py` and its
`generate_all_domains.py` wrapper), batch CLI (`scripts/run_domain_batch.py`),
and nightly CLI (`scripts/pipeline_nightly.py`) accept:

- `--plan-freshness-lint`: default off. Nightly JSON key:
  `"plan_freshness_lint": true`.
- `--scenario-hint-cap`: default off. Nightly JSON key:
  `"scenario_hint_cap": true`.

Nightly JSON values must be booleans. Missing keys and false values leave
commands unchanged. The flags affect generation only, not judge, ingestion,
publisher, or doc-check arguments. For interleaved runs, explicit flags apply
to both arms; use an experiment boundary, not the running Experiment A.

## Lifecycle behavior

`shared/product_freshness.plan_freshness_findings` scans `existing_system`,
`best_action`, and every `mistakes[].action`. Current-name hits require
re-planning. Retired best-action destinations require re-planning. A retired
product may remain as existing-system context, an intentionally wrong mistake,
or an explicit migration source (`migrate from`, `replace`, `stop using`, etc.).
Each occurrence is checked: “migrate from OLD to OLD” is blocked. More-specific
entries own their spans, so `Vertex AI Vision` is not incorrectly treated as a
generic `Vertex AI` rename.

The check runs before documentation retrieval. Failed attempts save a separate
`plan_freshness_check` with findings, not a fake documentation `proof`. Feedback
is deterministic and capped at 2,400 characters. Re-planning uses the existing
maximum of three decision attempts, including any real doc-check vetoes. There
is no extra quality retry or model call outside that loop. Exhaustion is a
`DecisionVetoError`, so quality-only continuation remains bounded.

Lifecycle hints never enter `scope["domain_prompt"]`. The doc checker, independent
judges, and learner publication gates retain their original inputs and rules.
Enabled flags are recorded on generation artifacts. Resume rejects a changed
planner experiment flag.

## Frozen lifecycle sources

The card builder supplied the following official page excerpts from the frozen
pre-experiment corpus. No paid search/model calls were used for this work.
`as_of` records the corpus capture date, not a live freshness claim.

| Entry | Classification | Lifecycle date | As of | Source |
|---|---|---|---|---|
| `imagen-3.0-capability-001` | Retired/discontinued endpoint | Migration deadline 2026-06-30 | 2026-10-14 | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/upscale-image |
| `Vertex AI Vision` | Retired | End of Life 2026-09-30 | 2026-10-14 | https://docs.cloud.google.com/vision-ai/docs/object-detector-model |
| `Optimized online serving` | Deprecated, not retired | Deprecation/frozen support from 2026-05-17; scheduled sunset 2027-02-17 | 2026-10-25 | https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/featurestore/latest/overview |

Supporting excerpt for Imagen: “The following table describes image generation
endpoints that are deprecated and their replacements. We recommend updating
your model endpoints before June 30, 2026, to avoid service disruption.” The
“Discontinued endpoints” table includes `imagen-3.0-capability-001` with
`gemini-2.5-flash-image` as its recommended migration. This is a migration
recommendation, not a claim that all capabilities are equivalent.

Supporting excerpt for Vision: “Vertex AI Vision is deprecated as of June 15,
2026 and reaches End of Life on September 30, 2026.” No unsupported one-to-one
replacement name was invented.

Supporting excerpt for Optimized online serving: “Beginning on May 17, 2026,
no new features will be added and only critical patches will be provided. On
February 17, 2027, the capability will be fully sunset and APIs will no longer
be available.” This entry is nonblocking while classified as deprecated.
Frozen entries require explicit review/update at future experiment boundaries;
they do not silently advance status with the wall clock. Feature Store Legacy
was not added as retired: no dated retirement evidence was supplied.

These entries live in `certs/product-lexicon.json` under `planner_products`.
The original `products` list remains unchanged. Both the default learner gate
and existing v6 naming guidance read only `products` and ignore this new section.
This is essential to keeping Experiment A unchanged.

## Scenario behavior

With `--scenario-hint-cap`, unmapped bank hints need at least **two distinct
normalized tokens** in common with the exact `objective_text`, not just the
broader subsection or its services. At most **three** unmapped hints survive,
ranked by that overlap. Duplicates do not consume that cap. Exact-objective bank
history and in-batch plan/candidate history retain their existing priority and
12-row overall bound. The default path retains its previous relevance rule,
sort order, output schema, and 12-hint allowance. Full-bank duplicate gates are
not changed.

## Verification

Initial focused run:

```
env -i PATH="$PATH" HOME="$HOME" CI=true uv run pytest -q \
  tests/test_planner_checks.py tests/test_product_freshness.py \
  tests/test_pipeline_yield.py tests/test_run_domain_batch.py \
  tests/test_pipeline_nightly.py
```

Result: **134 passed**, 25 dependency deprecation warnings, 6.40 seconds.

Coverage includes opt-in/off behavior; pre-fetch ordering; three-attempt
exhaustion; mixed lint/doc vetoes sharing the same budget; retired context and
migration sources vs destinations; renamed action fields; URLs and token
boundaries; deprecated vs retired separation; default learner/v6 exclusions;
objective overlap/cap/deduplication; generation-only CLI forwarding; boolean
config validation. Final focused run added full CLI/config and saved-resume checks and included
`tests/test_decision_first_v4.py` and `tests/test_doccheck_names.py`: **179 passed**,
25 dependency deprecation warnings, **8.38 seconds**. The parent owns the full
repository gate after integration.


## Explicit A vs A+card control-pack follow-up

`--ab-control-pack PATH` is now available on generator, batch and nightly CLIs;
nightly JSON key is `ab_control_pack`. It requires `--ab-interleaved`. Without
this option the control remains unmodified and no control-pack metadata is added.
With it, both arms receive only their selected writer pack: base A on control,
base A plus the objective card on challenger. Docs, verification, external judge
requests and other nonwriters receive neither pack.

Explicit artifacts include `ab_control_pack` provenance (`sha256`, `stage`,
`source_run`, `policy`) and `ab_experiment.control_sha256`. Both assignments
include `control_sha256` and each arm's `prompt_pack_sha256`. The optional
interleave argument is `control_pack_sha256`. Control policy bindings receive
the same certification, doc-check and distractor-evidence checks as challenger
policy bindings. Resume cannot silently discard an existing control hash;
existing unsupported A/B resume restrictions remain in force.

Focused follow-up suite:

```
env -i PATH="$PATH" HOME="$HOME" CI=true uv run pytest -q \
  tests/test_ab_control_pack.py tests/test_optimize_ab.py \
  tests/test_planner_checks.py tests/test_run_domain_batch.py \
  tests/test_pipeline_nightly.py
```

Result: **188 passed**, 2 dependency deprecation warnings, **13.32 seconds**.
The actual generator transport test records both arms' plan/write/cite pack
hashes, asserts documentation/verification active packs are `None`, and checks
that external requests contain neither the base instructions nor card text.
The tests also cover policy mismatches, CLI/config forwarding, absent-option
metadata, and saved-control hash protection. Reviewer confirmed transport
coverage resolves the A vs A+card gap.

An additional native `uv run python` parity script loaded the pre-change
`shared/ab_experiment.py` from repository HEAD. Across **40** seed/cohort cases,
old assignments matched the current default and explicit-`None` assignments
exactly. No full repository gate was started by this worker.
