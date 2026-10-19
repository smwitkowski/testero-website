# Live A/B failure: offline diagnosis and repair

Draft PR #283. No rollout. All efficiency flags remain off. This worker made no
live calls, read no environment secrets and made no production writes.

## What the recorded run actually shows

The current immutable-input hashes below include coordinator verdict ingestion;
they differ from earlier snapshots. All **63 retained plans** were annotated:
27 baseline and36 treatment, across12 candidates per arm, including all vetoes.
The call journals agree with these counts (the earlier36/36 summary was wrong).
Baseline6/12 passed verification and5/6 passed the external judge; no DB writes.
Treatment1/12 passed verification, not zero. That candidate reached writer and
external judge but frozen-request validation rejected the extra `retrieval`
proof field (`Invalid frozen decision plan or docs veto proof`). This repair
accepts strictly validated v3 provenance while leaving core proof/evidence gates
unchanged. It does not claim the candidate would pass an independent judge.

## Diagnosis

See `diagnosis-counts.json/.md` and the three analyst ledgers. All728 recorded
chunk IDs resolve to exact original source spans; reconstructed ranking alone
did not match31/36 attempts, so actual IDs, not replay guesses, determine omission.
Candidate-level evidence classes: **(a)1** with known support omitted (candidate6),
**(b)0 confirmed** cache-only support discoveries, **(c)1** with a documented
contradiction (candidate11's narrow unconditional idle-capacity claim), and
**10 unknown/mixed**. These are not complete causal diagnoses of every failure.
No `not_found` row is counted as genuinely unsupported. Broad API listings do
not establish survival/CNN/encoder capabilities or comparative superiority.
One missing passage or one contradiction does not establish the entire plan's
quality. Cache search was limited; zero confirmed is not proof of no such pages.

## Current policy and recall

Plan-only clause queries cover the best action, each decisive constraint, every
distractor action and scenario reason. Long reasons retain context and get their
own query turns. Adjacent technical-word scoring uses only plan text. No gold
support span/annotation enters selection. Lexical claim-to-chunk navigation is
explicitly not evidence of support. Immutable source spans/hashes remain intact.

Selected opt-in constants: chunk2,200, overlap350, top3, neighbors1, sections off,
query mode`claims`, **180,000-character document cap** (was130,000; approximately
45k documentation tokens at characters/4, excluding plan/navigation fields).
130k with phrase scoring recovered30/34 baseline and30/33 treatment supported
claims; it fails95%. The selected180k point recovered **34/34 baseline and33/33
treatment (67/67=100%)** with every required supporting span, not just one
conjunct. This is analyst calibration, not held-out semantic noninferiority.
Not-found, partial, contradiction, judgment and scenario rows stay separate;
field coverage does not prove complete atomic semantic annotation.

`claim-support-selected.json` validates source hashes/bounds, unique analyst IDs,
every plan action/reason/constraint field and all63 attempt identities. It stores
current source/config/input/ledger hashes. Old successful-proof receipt reports
cannot authorize A/B. Independent reviewers found and fixed denominator,
conjunctive-support, provenance and validator gaps before this report.

One cheap **evidence-missing** veto may escalate **once per candidate**, not per
replacement, to the baseline full-document verifier signature. It receives the
original current fetched pages, no retrieval/stable-prefix variant. No automatic
approval or relaxed quality threshold. Cheap/final proofs, trigger and explicit
boolean call metadata persist; later replacements remain bounded by3attempts.
Full docs still serve mechanical receipt checks, writer and independent judges.

## Tokens and quality

See `token-model.md/.json`. All repaired prompt sizes are characters/4 estimates,
not new provider usage. Historical vetoes only proxy escalation frequency.
Expected accepted yield assumes baseline verification6/12 and judge5/6; no
full-doc counterfactual has been run. Actual baseline normalized input/output
are3,862,191/84,468: **789,332 total tokens per external judge pass** (5 passes,
not production accepts). Baseline-calibrated modeled input is
`2,300,079 + E*C`; with100k input/full escalation and E=8 or12 this gives
**620,016 or700,016 input tokens per modeled accept**, assuming5accepts/12.
This model holds downstream/attempt behavior fixed; the token report separately
models output using328tokens/escalation (637,434–717,697 total tokens/accept). At E=0 it is460,016 input/accept (only1.68× baseline input reduction).
Anthropic cache read/creation counts are additive; Codex cached input is a subset. Zero accepts means infinite tokens per
accepted. The3–5× target remains unproven; do not infer it from prompt shrinkage.

## Reproduce offline claim-support report

Requires the frozen recorded A/B artifacts, not credentials. The exact frozen
hashes are in`claim-support-selected.json` and the A/B runner.

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-retrieval-1019/content-pipeline
env -i PATH="$PATH" HOME="$HOME" uv run python scripts/replay_claim_support.py \
  --baseline .cache/generation/retrieval-1019-b/baseline.json \
  --treatment .cache/generation/retrieval-1019-b/treatment.json \
  --ledger calibration/retrieval-2026-10-19/live-ab-failure/baseline-claims.json \
  --ledger calibration/retrieval-2026-10-19/live-ab-failure/treatment-first.json \
  --ledger calibration/retrieval-2026-10-19/live-ab-failure/treatment-second.json \
  --output calibration/retrieval-2026-10-19/live-ab-failure/claim-support-selected.json
```

## Coordinator comparison (not executed here)

Print only, safe without credentials:

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-retrieval-1019/content-pipeline
env -i PATH="$PATH" HOME="$HOME" uv run python scripts/run_retrieval_ab.py \
  --bank /Users/switkowski/Projects/Testero/hq/drafts/ab-2026-10-17/existing-export.json \
  --tag retrieval-1019-c \
  --claim-report calibration/retrieval-2026-10-19/live-ab-failure/claim-support-selected.json
```

Only the coordinator may supply approved credentials and append`--execute`.
Use a new tag if already present. The gate checks exact frozen A/B inputs,
ledger hashes, current code/config/budget, complete field/attempt coverage and
>=95% per arm. An explicit`--allow-failed-recall` is exploratory only, never
rollout approval. Keep both arms' objectives/distractor policy/judges identical.
A fresh held-out quality comparison is still required before enablement.

## Verification

Clean-env pipeline: `env -i PATH="$PATH" HOME="$HOME" uv run pytest -q`:
**2,181 passed,3 skipped,48 subtests**, including retrieval, escalation,
provenance and A/B authorization tests. Root clean-env npm test: **1,183 passed**;
lint, typecheck and Docker build passed. Current claim gate independently
checked true; dry coordinator plan exited0. No live model quality or cloud
validation is inferred from fixtures.
