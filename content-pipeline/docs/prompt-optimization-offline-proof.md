# Prompt-optimization harness: offline proof

Date: 2026-10-25. Branch: `prime/prompt-optimization`, stacked on open
PR #314 (`prime/doccheck-fixes`, base `main`). No merge or production write.

## Scope and limitations

- No live optimization, model, paid judge, or evaluation calls were made.
- No `.env*` files were read. Native Python verification used
  `PYTHON_DOTENV_DISABLED=1`; test fixtures block sockets and CLI subprocesses.
- Dataset sources were the two read-only saved-generation roots named in the task.
  Actual question text, full documents, generated demos and raw artifacts remain
  local under ignored `.cache/optimize-verification/`, not in this PR.
- Production has five downstream council seats: Claude blind/style/evidence and
  Gemini Argon blind/review. Proof is a sixth check overall, not a sixth council
  seat. Proof uses the writer model. No judge rubric was changed or invented.
- Hard spend admission bounds configured local reservations, not invoices.
  Subscription output is an explicit configurable estimate. Coordinator-approved
  nonzero price upper bounds are required before live work.

## Read-only corpus build

Command (from `content-pipeline`):

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.build_datasets \
  /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation \
  /Users/switkowski/Projects/Testero/frontend.pipeline-pilot/content-pipeline/.cache/generation \
  --output-dir /Users/switkowski/Projects/Testero/frontend.prime-optimize/content-pipeline/.cache/optimize-verification/datasets \
  --seed 42
```

| Dataset | Train | Dev | Test |
| --- | ---: | ---: | ---: |
| Plan rows | 1,412 | 409 | 373 |
| Fully reviewed draft rows | 87 | 39 | 16 |
| Universal objective IDs | 232 | 49 | 51 |
| Eligible plan objective IDs | 205 | 41 | 45 |
| Eligible draft objective IDs | 30 | 13 | 5 |

All 2,336 examples passed the optimizer's exact typed-input/output conversion.
Of 272 saved accepted candidates, 130 review-only Argon v2 records were excluded
from complete-five-seat demos. Other invalid or unverifiable draft/proof records
were excluded and counted. No cross-split text duplicates were found in this
corpus; synthetic tests exercise that filter. Recorded option-local repair
attempts are excluded from normal-plan training; this corpus had none.

Manifest SHA-256:
`1fa6a57146d6c5959470bdd4f9d171e32b0ecd12526c35f64653e2176235c821`.

## Actual offline labeled bootstrap

A real DSPy `LabeledFewShot` draft run on these datasets, with PMLE/v5, seed 42
and four diverse accepted train demos per domain, completed. Output was local:
`.cache/optimize-verification/draft-bootstrap-offline-v1.json`.

- 24 typed demos across six PMLE domains.
- 0 model transport attempts, 0 metric calls, USD 0 reserved.
- Pack manifest hash matches the built dataset manifest.
- All selected training objective IDs are disjoint from eligible test objectives.
- The plan test pool contains 183 PMLE records covering seven eligible objectives
  for later coordinator-only paired evaluation. No held-out model evaluation ran.

## Independent safety review

The initial implementation's DSPy queued-work lifetime, implicit foreign-run
resume, production-prompt transform mismatch and duplicate reflection judging
were reproduced or inspected in the installed DSPy 3.0.4/GEPA API, then fixed.
Regression tests use the real installed Evaluate/GEPA APIs with fake writers,
reflection and judges, including a successful nonperfect-score mutation cycle.
Optimizer evaluation runs inline, so no queued requests survive a budget stop.
Existing run directories are refused. Frozen practitioner/v6/order transforms
apply per call, but packs export only tunable base instructions. Exact-candidate
score/feedback is cached for GEPA reflection without another paid judge call.

## Verification

| Check | Completed result |
| --- | --- |
| `cd content-pipeline && PYTHON_DOTENV_DISABLED=1 uv run pytest -q` | **3,718 passed, 3 skipped, 51 subtests** (104.24s) |
| `env -i PATH="$PATH" HOME="$HOME" CI=true npm test` | **1,952 passed**, 109 files |
| `env -i PATH="$PATH" HOME="$HOME" CI=true npm run lint` | exit 0 |
| `env -i PATH="$PATH" HOME="$HOME" CI=true npm run typecheck` | exit 0 |
| `docker build .` | exit 0; build layers cached |
| `git diff --check` | exit 0 |

Python warnings are dependency deprecations; three skips remain explicit.
Docker reports the existing Dockerfile secret-ENV warning; this work does not
change the Dockerfile or claim new live-cloud validation.

`docs/prompt-optimization-verification.json` records source hashes, commands and
measured counts. Full local logs are ignored at `.cache/optimize-verification/`.
The harness is ready for coordinator-approved live runs; there is **no measured
live council-yield improvement, promotion decision or deployment** in this proof.
