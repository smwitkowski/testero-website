# Planner documentation commitments — default-off experiment

## Status

Separate `prime/veto-precheck-1019` from current `origin/main`7e1c9ad, not
stacked on PR283. No merge, live model/API calls, credential reads or production
writes. The baseline remains unchanged; PR283 safe cache/prefix defaults are NOT
silently cherry-picked. `--planner-doc-precheck` stays OFF.

The planner proposes one official page+section commitment for A and each B-D
scenario reason, with the exact target and underlying support claim. It lists
known unresolved prerequisites, ambiguity and conflicts. Only approved
`https://docs.cloud.google.com` discovery pages are requested; redirects retain
existing official-host validation. At most4 unique extra pages are fetched via
the existing run-local cache, never arbitrary URLs or snippets as evidence.

After normal discovery/fetch, eligibility checks metadata completeness, exact
plan bindings, same fetched page provenance/hash, and case-sensitive section text
presence after whitespace collapse. URL fragments alone do not establish section
presence. Headings are navigation hints: the flattened text cannot prove heading
structure, claim entailment, correctness, missing prerequisites or absence of
alternative answers. `support_claim` is recorded, not lexically scored. Explicit
unresolved issues reject; an empty list does not prove none exist. Missing or
malformed typed commitments consume the same3-attempt budget and trigger a new
plan. No precheck can approve a candidate or replace full verification.

Rejected attempts record `doc_precheck`/`precheck_rejection` and
`verification_skipped`; no fake full-verifier proof is written. A passing precheck
runs the exact original full-doc verifier, writer, citation and independent judge
gates. All full sources stay available. Evidence-missing passage retrieval and
escalation from PR283 are not part of this branch.

## Historical evaluation: honest unknowns

`evaluation.json/.md` audit all167 historical attempts: **97 failed proofs,
65 actual proof passes,5 no-proof attempts,32 accepted candidates**. The earlier
70-pass narrative incorrectly inferred passes as167−97. The dominant-cause veto
taxonomy remains65 evidence/15 prerequisites/13 alternatives/4 incompatibilities;
these categories are not deterministic cheap catches.

All63 retained live plans (27 baseline,36 treatment) have **56 vetoes,7 proof
passes,0 accepted,5 external-judge passes**. All1010 analyst rows were read;
119/119 recorded support spans matched exact saved URLs/hashes/text. This
retrospective evidence does not reconstruct planner commitments.

`live-*-eligibility.json` evaluates all63 with the new reporting code:
**0 measured shadow attempts,63 unmeasured**. Newly required metadata is absent,
so it is NOT counted as a historical caught veto or a false block. The targets
**≥40% veto catch and ≤5% false blocks among eventual passes are unproven**.
No semantic classifier, ground-truth quality inference or token savings is claimed.

## Coordinator command (dry by default)

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-veto-precheck-1019/content-pipeline
env -i PATH="$PATH" HOME="$HOME" uv run python scripts/run_doc_precheck_ab.py \
  --bank /Users/switkowski/Projects/Testero/hq/drafts/ab-2026-10-17/existing-export.json \
  --tag veto-precheck-1019-a --count 12
```

Coordinator may append `--execute`
only with approved injected credentials; do not source env files. The dry run
prints a three-arm manifest without creating files or making service calls:
unchanged baseline, commitment+**shadow** precheck, and commitment+blocking
precheck. Same objective seed is not the same stochastic generated plan. Use a
fresh tag and freeze code/bank/model settings before running. External judging
means generation exports requests, not acceptance or publication.

For each arm, coordinator subsequently runs the unchanged independent judges:

```sh
uv run python scripts/judge_requests.py \
  --requests .cache/generation/veto-precheck-1019-a/shadow.judge-requests \
  --verdicts .cache/generation/veto-precheck-1019-a/shadow.verdicts \
  --judge-model claude --parallel 1 --argon-gate
uv run python scripts/ingest_external_verdicts.py \
  --artifact .cache/generation/veto-precheck-1019-a/shadow.json \
  --verdicts .cache/generation/veto-precheck-1019-a/shadow.verdicts
uv run python scripts/evaluate_doc_precheck.py \
  --artifact .cache/generation/veto-precheck-1019-a/shadow.json \
  --output .cache/generation/veto-precheck-1019-a/shadow-evaluation.json
```

Repeat judge/ingest for baseline/treatment.
Evaluate every shadow attempt, not only would-block attempts. Catch denominator:
all shadow full-verifier vetoes. False-block denominators are reported separately
for full-verifier survivors, independent-judge passes, and actual accepted DRAFTs.
External-only artifacts can have zero accepted; null is unknown, not0%. The target
uses independent-judge-passing survivors and requires complete judge coverage and
unique surviving-plan lineage; accepted/DRAFT remains a separate measure. Preserve
all candidate/attempt lineage. `targets_observed` is descriptive and never rollout
authorization. Small samples (especially12 candidates) cannot establish a ≤5%
population false-block rate; add predeclared held-out sampling and confidence bounds.
Zero false blocks in59 independent passing plans is only about a5% one-sided95%
upper bound; account for clustered attempts. Unknown quality requires further
coordinator evaluation, not enabling the flag.

## Verification

Focused offline schema, source, control-flow and evaluation tests:41 passed.
Root clean-env tests:1,183 passed; lint/typecheck/Docker all exit0. Docker retains
the existing ENV secret-name warning; npm install reported20 audit findings
(2 low,3 moderate,14 high,1 critical). No dependencies were changed. Clean full
pipeline gate run before PR. No fixture test is represented as a live quality win.
