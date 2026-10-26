# Opt-in doccheck policy v6

`--doccheck-policy {v5,v6}` defaults to **v5** in both generators and
`run-domain-batch.sh`. No default or quality gate changes follow from this PR.
New v6 artifacts freeze the choice on batch/scopes/candidates. Frozen retries
and resumes reject a different choice. Absent policy means historical v5.

V6 changes only decision planning, retrieval and its proof:

1. A wrong option loses from a documented positive fact plus an already stated
   scenario constraint. Unsupported facts, unsupported negative comparisons,
   wrong facts, renamed products, hidden gotchas and second defensible answers
   still fail. All four semantic checks and exact A-D receipts stay mandatory.
2. An explicit isolated B-D failure can repair only those actions/losing reasons.
   Scenario, key, constraints and passing options stay byte-identical. Every repair
   retrieves and runs the full proof again, within the existing three-attempt cap.
   Key/global/ambiguous failures use a full replacement. No council changes.
3. Existing retrieval already fetches up to two pages per option (main5 + A-D2,
   at most13 total). V6 uses positive-behavior queries for B-D instead of assuming
   their proposed negative reason appears in docs. Same allowlist, cache, receipts
   and documentation context budget apply. No second retrieval pass was added.
4. The first v6 plan receives current names from the local product lexicon plus
   explicit current-name rules. Frozen PDE guide-brand/style rules are unchanged.
5. The recorded all-true case was **not a passed proof**. Candidate
   `8d5a3f5d-8bb9-57fc-8425-25267c0836c7` had all four semantic flags true but
   labels such as `A - Best action`, so its receipts failed mechanically. V6 uses
   literal A-D output schema values; it does not guess labels or approve malformed
   outputs. V6 veto diagnostics include failed receipt checks, instead of displaying
   only a positive semantic explanation. A final replacement with all semantic and
   mechanical checks true proceeds to writing; bad quotes/URLs still fail closed.

Offline canned critic cases verify the rubric contract, not live semantic judgment.
The recorded fixture preserves raw plan/proof and allowlisted source provenance.
Sixteen frozen main (`5c9814c`) fingerprints cover v5 planner/verifier prompt,
input, field and schema bytes across PMLE/PDE, strict/consistent, both input orders.
No live yield, quality or token savings are claimed.

## Coordinator-only 40 vs40 A/B: generation and judging only

These are future authorized commands, **not work run for this PR**. Inject normal
Codex/Claude login and discovery/Argon credentials without reading `.env` files.
Run from this checkout's `content-pipeline/`; use fresh basenames if any outputs
exist. Each arm has20 candidates for each of the same two exact objectives and
seed2510, serial generation, same model/efforts/evidence/council policy. Separate
single-objective artifacts prevent adaptive objective rotation from changing the
comparison scopes. Judge every ready request with `--full-gate-sample 1` so full
council rates have comparable denominators. Retrieval caches may be warm in either
arm; report cache status separately from token costs.

After any nonzero generation exit, inspect the artifact first. Ordinary candidate
vetoes remain failed observations; do not replace them to reach40 passing items.
Stop on system/auth/transport errors. `--continue-quality-rejections` keeps ordinary
vetoes from ending the cohort before all40 planned candidates are attempted; it
does not turn them into passes. After confirmed ordinary vetoes only, judge
ready requests from the same artifact. No command below ingests or writes DB rows.
Do **not** substitute the coordinator batch runner: its normal flow includes ingest.

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-doccheck/content-pipeline
PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 20 --seed 2510 \
  --objective machine-learning-engineer:standard:1.1:5 \
  --model codex --judge-model external --parallel 1 --gen-effort high --cite-effort medium \
  --continue-quality-rejections --distractor-evidence strict --doccheck-policy v5 --decision-attempts 3 \
  --doc-cache --verify-stable-prefix --argon-gate --artifact .cache/generation/doccheck-ab-v5-serving-40x40.json
PYTHON_DOTENV_DISABLED=1 uv run python scripts/judge_requests.py \
  --requests .cache/generation/doccheck-ab-v5-serving-40x40.judge-requests \
  --verdicts .cache/generation/doccheck-ab-v5-serving-40x40.verdicts \
  --judge-model claude --parallel 1 --argon-gate --full-gate-sample 1

PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 20 --seed 2510 \
  --objective machine-learning-engineer:standard:6.1:1 \
  --model codex --judge-model external --parallel 1 --gen-effort high --cite-effort medium \
  --continue-quality-rejections --distractor-evidence strict --doccheck-policy v5 --decision-attempts 3 \
  --doc-cache --verify-stable-prefix --argon-gate --artifact .cache/generation/doccheck-ab-v5-governance-40x40.json
PYTHON_DOTENV_DISABLED=1 uv run python scripts/judge_requests.py \
  --requests .cache/generation/doccheck-ab-v5-governance-40x40.judge-requests \
  --verdicts .cache/generation/doccheck-ab-v5-governance-40x40.verdicts \
  --judge-model claude --parallel 1 --argon-gate --full-gate-sample 1

PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 20 --seed 2510 \
  --objective machine-learning-engineer:standard:1.1:5 \
  --model codex --judge-model external --parallel 1 --gen-effort high --cite-effort medium \
  --continue-quality-rejections --distractor-evidence strict --doccheck-policy v6 --decision-attempts 3 \
  --doc-cache --verify-stable-prefix --argon-gate --artifact .cache/generation/doccheck-ab-v6-serving-40x40.json
PYTHON_DOTENV_DISABLED=1 uv run python scripts/judge_requests.py \
  --requests .cache/generation/doccheck-ab-v6-serving-40x40.judge-requests \
  --verdicts .cache/generation/doccheck-ab-v6-serving-40x40.verdicts \
  --judge-model claude --parallel 1 --argon-gate --full-gate-sample 1

PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 20 --seed 2510 \
  --objective machine-learning-engineer:standard:6.1:1 \
  --model codex --judge-model external --parallel 1 --gen-effort high --cite-effort medium \
  --continue-quality-rejections --distractor-evidence strict --doccheck-policy v6 --decision-attempts 3 \
  --doc-cache --verify-stable-prefix --argon-gate --artifact .cache/generation/doccheck-ab-v6-governance-40x40.json
PYTHON_DOTENV_DISABLED=1 uv run python scripts/judge_requests.py \
  --requests .cache/generation/doccheck-ab-v6-governance-40x40.judge-requests \
  --verdicts .cache/generation/doccheck-ab-v6-governance-40x40.verdicts \
  --judge-model claude --parallel 1 --argon-gate --full-gate-sample 1
```

Compare across each40-candidate arm:
- Doccheck passes /40 candidates, and failed semantic versus mechanical checks.
- Full council passes /doccheck-pass candidates, with every missing/error verdict
  counted separately; also report full council passes /40 (end-to-end yield).
- Known input/output tokens per full-council-pass candidate, including failed plans,
  all attempts and judging. State usage coverage; missing usage is not zero.
- Inspect unsupported claims, second answers, names, failed receipts and repair scope.

Keep v5 as default unless council quality holds and accepted-per-token improves.
A 40-item arm is small; report uncertainty. Council-pass means no publication or
DRAFT ingestion has occurred. No ingest, repair, recovery or publication command is
part of this A/B. Do not infer live gains from offline replay tests.

## Open follow-up (outside this PR)

Independent review reproduced a pre-existing two-wave PDE resume failure under
**v5 and v6**: `scripts/pde_retry.py:399` compares saved authored distractors in
display order after global option balancing changes that order. The same stems,
key and distractor set can produce `Saved retry comparison bank differs from
earlier authored content`. No default resume implementation is changed here.
The new real one-wave resume test uses the default comparator. The two-wave
policy-propagation test explicitly injects a canonical distractor-set comparator
to isolate this separate defect; it does **not** prove default two-wave resume
works. A separate scoped fix and regression review are proposed.

## Offline verification

Final native pipeline run: **3605 passed, 3 skipped, 51 subtests passed**.
All writers froze before the run; tracked source/test hashes matched afterward.
App: **1952 tests across109 files passed**. Clean-env lint, typecheck and Docker
build passed. Docker used cached layers and emitted the existing placeholder-key
Dockerfile warning. See [verification.json](../calibration/doccheck-v6/verification.json)
for commands, scope-preview checks and snapshot digest. Dependency deprecation
warnings remain unchanged. No live A/B, model evaluation or production write ran.
