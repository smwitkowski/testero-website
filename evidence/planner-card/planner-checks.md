# Opt-in planner checks and A+card control

| Feature | CLI | Nightly key |
|---|---|---|
|Lifecycle/current names|`--plan-freshness-lint`|`plan_freshness_lint` boolean|
|Scenario hints|`--scenario-hint-cap`|`scenario_hint_cap` boolean|
|Explicit A control|`--ab-control-pack PATH`|`ab_control_pack` path|

Absent/default options preserve legacy commands, artifact fields, packs and A/B assignments. Explicit control requires interleaving and policy compatibility. Actual mocked pipeline tests verify per-arm plan/draft/citation pack hashes while doc fetch/proof/judge requests receive no pack context. Forty legacy seed/cohort helper outputs matched unchanged defaults.

Lifecycle lint scans existing_system, best_action and mistake actions before doc fetch. Renames block; retired recommended destinations block; existing-system/migration-source context remains valid. Feedback shares the original maximum three-attempt budget. It never changes domain_prompt or publication/doc-check inputs. New facts live in planner_products; original products list is unchanged.

Sourced frozen entries: Imagen capability001 discontinued/migration deadline2026-06-30 (docs.cloud.google.com/vertex-ai/generative-ai/docs/image/upscale-image, capture2026-10-14); Vertex AI Vision EOL2026-09-30 (docs.cloud.google.com/vision-ai/docs/object-detector-model, capture2026-10-14); Optimized online serving deprecated2026-05-17 with future sunset2027-02-17 (docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/featurestore/latest/overview, capture2026-10-25). Deprecated is nonblocking, not silently converted to retired by wall clock. Migration recommendations do not prove capability equivalence.

Hint cap: at most three unmapped hints after dedup, each sharing at least two normalized tokens with exact objective_text. Exact-objective/batch history priority and overall 12-row bound remain. Resume binds options/control metadata.

Focused control/check suites passed 188. Full current gate is in DELIVERY.md. Detailed transient logs are local only.
