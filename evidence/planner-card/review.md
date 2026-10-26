# Independent review — planner card (Parts 1 and 2 wiring)

**Current status: approved in reviewed scope. All findings below are resolved. No unresolved blocking finding.**

Scope: statistics, guardrails, packs, lifecycle lint, hint cap, CLI/nightly and resume. Card builder excluded. No source edits, secret reads, model/search calls or DB access. Full gate not rerun.

## Resolved initial findings (historical evidence)

1. **RESOLVED P1 — Original A+card control used no pack.** `content-pipeline/scripts/generate_pmle_questions.py:535-536` always selects `None` for control. `shared/ab_experiment.py:40-41` records a null control-pack hash. `scripts/optimize/build_card_pack.py:43-65` preserves a supplied base pack only inside the challenger. Thus `--base-pack A` tests plain vs A+card, confounding A with the cards. Proposed fix: explicit opt-in control-pack transport, frozen hashes for both arms, and validation in generation/reporting; preserve absent-option behavior. Add a transport test proving control receives A and challenger receives A+card while proof/retrieval/judges receive neither. **Resolved on re-review:** explicit `--ab-control-pack` is wired across generator/batch/nightly; control hashes are bound in assignment/report/schedule/audits. Actual generator tests verify A vs A+card plan/write/cite transport, cleared docs/proof contexts, and no pack prose in judge requests. Checks worker reports **188 passed**, 2 dependency warnings, 13.32s in the focused rerun.

2. **RESOLVED P1 — Original reports pooled different planner-flag configurations.** `content-pipeline/scripts/optimize/ab_report.py:220-223` checks only experiment ID and challenger hash across artifacts. The new flags live only at payload level (`scripts/generate_pmle_questions.py:391-395`), so neither changes that hash. Switching either between nights silently changes both arms and the treatment context mid-experiment. Proposed fix: normalize absent flags to `False`; require real booleans and an identical `(plan_freshness_lint, scenario_hint_cap)` tuple across artifacts; bind the tuple in report/schedule provenance. Add rejection tests for either changed flag and acceptance of absent versus explicit false.

   Focused reproduction in the project environment: two synthetic 80-pair cohorts; first flags absent, second both true; all other experiment IDs and pack hashes identical. Only `candidate_row` gate replay was stubbed. Real assignment validation, fixed-look inference, summaries and promotion returned:
   ```json
   {"mixed_planner_flags": true, "pairs": 160, "promote": true, "reasons": []}
   ```
   Command used `env -i ... PYTHON_DOTENV_DISABLED=1 uv run --no-sync python -c ...`; exit 0. Temporary synthetic inputs were removed.

## Other checks

- No arithmetic finding in rational-lattice sign flips, one-sided direction/ties, fixed 80/160 look thresholds, equal-weight objective bootstrap, or secondary Hoeffding fields.
- New planner lexicon entries are separate from learner publication and v6 naming inputs. The lint and hint cap are off by default; old pack hashes retain their normalized shape.
- Lifecycle lint runs before retrieval and shares the existing attempt cap. Explicit migration sources are allowed, retired destinations block, and renamed products block in scanned fields.
- Batch resume rejects changed new planner flags against the original artifact; retry waves inherit the generated command flags. Direct frozen-plan callers do not independently bind the flags to the source artifact; consider extending source-policy validation if that interface is used outside the batch wrapper.

Review status: both remediation diffs have been inspected with no new blocking findings. Finding 1 is resolved with focused test evidence. Finding 2 is resolved in the original reproduction (now raises `ValueError: Do not pool mixed A/B generation-option fingerprints` at `ab_report.py:245`). New tests cover changed flags, absent/false equivalence, nonboolean rejection, and control-provenance mismatches. Statistics worker reports **91 passed**, 11.00s in its follow-up focused run. Frozen card samples have since been reviewed and source-safety refined; see final sign-off below.


## Frozen card sample review (four cards; no model calls)

Hashes match all four texts. Selected claim associations resolve to the saved full veto reasons and contain their anchors. Every selected anchor has two distinct candidate IDs. This validates association integrity, **not semantic completeness**.

### Resolved source-safety refinements (historical evidence)

3. **RESOLVED source-safety refinement — Entity-only anchors produced vague coverage claims.** `content-pipeline/scripts/optimize/build_planner_cards.py:210-219` accepts a whole first absence-clause object even when it is only a product name; `:233-236` renders this as “the proposed use of …”. In card `machine-learning-engineer:standard:1.2:3`, the selected anchor is only “Agent Platform RAG Engine specifically”. Candidate `006dfe3c-807c-57f1-9c02-6d068b0c3126` discusses supervised classification/tuning and unverified Engine-specific documentation. Candidate `284c228e-614e-547e-bc84-f5166cdb5c64` discusses retrieval of conversational examples and a deprecated Grounded Generation API page. No common concrete Engine use is identified in both reasons. The rendered claim should not imply a specific recurring unsupported capability that the evidence never names.

   Proposed deterministic replacement (no second model call): “Past RAG Engine plans lacked product-specific documentation; general RAG guidance was not enough to verify their claims.” Or omit this coverage claim and retain the sourced Imagen lifecycle section with a no-coverage-fact placeholder. Keep its existing two source associations. A generic rule should reject entity-only anchors unless a manually validated contextual rendering is supplied.

4. **RESOLVED source-safety refinement — Shortened TPU predicates lost critical single-slice/Multislice context.** The same extractor/renderer emits “the proposed use of TensorFlow's TPU distribution strategy” and “TPUStrategy's synchronous replication” for `machine-learning-engineer:standard:3.3:2`. In the latter claim, `21fbca94-88ba-5819-a24f-9dfe8a5ab954` says the pages do not verify “TPUStrategy's synchronous replication **and batch splitting**”; `ae4879cb-8d4e-50ec-b142-7a8985d4c338` says “synchronous replication **and gradient aggregation on the existing TPU slice**”. Both full reasons explicitly warn that TensorFlow's Multislice exclusion does **not** veto the single-slice scenario. Shortening a compound unverified claim to one component is not automatically entailed, and suppresses the most important scope caveat.

   Proposed deterministic rendering for the selected TPU anchors: “In prior TensorFlow single-slice TPU plans, the supplied scaling/Multislice guidance left the distribution behavior, including synchronous replication with batch splitting or gradient aggregation, unverified. Do not use Multislice's TensorFlow exclusion to reject a single-slice scenario.” Remove the redundant entity-only TPU strategy sentence. Retain the existing source association IDs and add a regression test for the contextual text. This is a historical documentation gap, not a claim that TPUStrategy lacks synchronous replication.

### Other sample checks

- `3.2:6`: “Model Garden full fine-tuning capability” is explicitly unverified in both full reasons. No invented service limitation was found. The coverage wording remains correctly scoped to the pages.
- `5.1:3`: “training-only augmentation behavior” is explicitly unverified in both full reasons. One reason also warns that augmentation inside an exported model does not imply it runs at inference; do not invert that caveat in future edits.
- Imagen lifecycle text is supported by a saved page span containing the discontinued-endpoint table and June 30, 2026 migration deadline. The span includes `imagen-3.0-capability-001`. The page ID/hash/date match the audit record.
- Optimized online serving text is supported by an explicit product-named span with critical-patch date May 17, 2026 and sunset February 17, 2027. It is correctly called deprecated, not already retired.
- Source-candidate lists currently include all eligible objective veto candidates, not only the two-per-claim selected associations. The audit makes the exact selected support visible; do not describe the larger list as independent support for every claim.
- `audit.heldout_objectives` is empty. The cards worker confirmed authorized-root monitor discovery/exclusions and no explicit cohort paths. No specific missed held-out item was identified; this discovery limit is documented below.

Both sample wording issues were fixed deterministically using the saved selection responses. Revised text hashes and the preserved original responses are documented in the final sign-off below; no additional Claude call was made.

Parent decision after severity review: the existing text is page-coverage wording rather than a false product-impossibility statement, so the vagueness/relevance concerns are not equivalent to the resolved P1 experiment bugs. Still, apply a deliberately safer deterministic rendering before final freeze: drop the entity-only RAG coverage claim and retain its sourced lifecycle fact; scope TPU wording to the actual single-slice/Multislice evidence and preserve its compound missing-coverage object. Preserve original Claude selections/responses and record the deterministic source-safety revision and new hashes. Reviewer has signed off the resulting exact text below; no additional calls were needed.


## Final sign-off after source-safety revision

**No unresolved blocking findings in the reviewed scope.** The two P1 experiment defects are resolved. The deliberate card source-safety refinements are also complete. This is review sign-off, not approval to enable any generation feature or promote an experimental arm.

- Canonical `content-pipeline/.cache/optimize/cards/pmle-planner-cards-v1.json` now contains four cards (245, 203, 392, 294 characters; median 269.5).
- `1.2:3` no longer makes the entity-only RAG coverage claim. It explicitly says `Coverage: No reliable recurring coverage claim retained.` The already-selected, dated Imagen fact and names remain. New text SHA256: `dd11f4b5bc432d54983e970805d0f554bb7e35c20257e0fc0a8f7ac7559855cc`.
- `3.3:2` now uses the reviewed 307-character compound coverage wording: “For proposed TensorFlow single-slice TPU training, the supplied scaling/Multislice pages did not establish the TPUStrategy synchronous-replication claims together with the proposed batch-splitting or gradient-aggregation behavior. Multislice's TensorFlow restriction does not rule out single-slice training.” Both full associated veto reasons support that scope and caveat. Redundant entity-only wording was removed. New full-card SHA256: `5199ca83e798b7c8929a2bf0d3b5c0603c8666f72deb7e4eab545dcfdc6bde98`.
- All four final text hashes independently match the canonical JSON. `card-safety-revision.json` old hashes match the initial reviewed cards; new hashes match the final cards. The original response JSON still contains the original removed claim selections. `cards.audit.json` separately records original model selections and revised selections. This is a deterministic source-safety correction, **not unchanged model output** and not response replacement.
- Inspected the saved focused log: **29 passed**, 3 dependency warnings, 5.56s. Tests cover entity-only rejection, lifecycle-only rendering, TPU scope, and offline re-rendering. No new model call was needed for this revision.
- Canary/gold discovery limitation is documented: only authorized roots/explicit cohort inputs were searched; none supplied a held-out objective. No specific missed held-out item was identified.
- Remaining limitation: `5.1:3` includes a genuine but potentially incidental Feature Store lifecycle fact. This may add prompt noise; it is not a false lifecycle claim or an enablement blocker. The narrowly curated TPU renderer is for this frozen source context, not evidence of a general semantic claim miner.

No source edits were made by this reviewer. Full gate results remain the parent's responsibility.
