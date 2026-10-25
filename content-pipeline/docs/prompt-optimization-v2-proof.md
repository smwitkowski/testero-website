# Prompt optimization v2 — offline verification

This change implements the design review in PR #315. It does not establish live
fidelity, critic accuracy or production yield. No paid/model calls, `.env` reads,
production writes, deployment or merge were performed.

## Verified behavior

- Default plan/v6/repair prompts remain byte-identical. Proof/council signatures
  and publishing gates stay frozen. Optional packs affect writers only.
- Hash-bound per-objective corpora include saved fetched pages across attempts.
  Production query templates rank candidates, and the production bounded context
  builder supplies the checker. Corpus sidecars avoid per-row text duplication.
- Optimization checker temperature is zero on configurable OpenRouter transports;
  production remains 0.7. Codex uses the existing serial CLI/pacing/backoff and
  preserves native DSPy predictor traces.
- The independent critic is refused below 0.75 balanced accuracy, with fewer than
  200 labeled train plans, missing classes, wrong model/rules hash or fixture-only
  evidence. Scores are 1.0 for docs+critic, 0.4 docs-only, otherwise at most 0.15.
- Capped plan/distractor/repair components, guarded proposals and round-robin
  plan/repair predictors preserve frozen fields during isolated v6 B–D repair.
  Only compact accepted train plans become frozen same-domain exemplars.
- GEPA leaves one validation pass plus two minibatches below the hard limiter.
  With 250 calls, 39 validation examples and minibatch 6 its own cap is 199.
  Interrupted native GEPA resumes candidates, cache/accounting and state, then
  emits a valid pack. Foreign manifests and changed inputs are refused.
- Generation-only A/B uses preassigned adjacent objective pairs with randomized
  arm order. Candidate artifacts and digests retain arm/hash/pair provenance.
  Reports replay frozen gates and compute conditional council/guardrail rates,
  objective-cluster paired differences and a conservative sequential decision.

## Completed commands and deliverable

Run the complete pipeline suite from `content-pipeline`:

```sh
PYTHON_DOTENV_DISABLED=1 uv run pytest -q
```

Final result: **3,834 passed, 3 skipped,
51 subtests passed** (123.07s (0:02:03)). Existing dependency warnings remain.
The final completed result and log hashes are in
[`prompt-optimization-v2-verification.json`](prompt-optimization-v2-verification.json).
All model transports in tests are mocked; network access is blocked by the suite.
Native installed GEPA tests exercise successful reflection, Codex plan+repair
traces, cap cancellation and interrupted/resumed state rather than only fake
optimizer constructors.

App gates from the frontend root:

```sh
env -i PATH="$PATH" HOME="$HOME" CI=true npm test
npm run lint
npm run typecheck
docker build .
```

App tests: **1,952 passed across 109 files**. Lint and typecheck exit 0.
Docker build exits 0, image
`sha256:54c3fea946aafc1e8dd0a3818068875dd0bc1c5bcbc98c6ca870859b7007f7fe`.
The existing placeholder `SUPABASE_SERVICE_ROLE_KEY` Docker ENV warning remains;
no actual credential is passed to the image build.

All six optimizer modules and both production runners pass their offline
`--help` checks. Raw logs remain ignored under `.cache/optimize/evidence-v2/`.

The actual zero-cost arm is generated locally at
`.cache/optimize/packs/zero-cost-pmle-v6.json`: **18 accepted train plans, 6 domains,
63,267 bytes, zero model calls**. Its frozen O3/O5/O6 text is verbatim and no full
DSPy draft demos are included. File SHA-256:
`299b0775e87dc572ce0735a5dba0835c331c5c72201dc3fc3b7a5b66b7d5fda8`.
Private plan/source bodies are not committed.

## Deliberately unmeasured or conditional

- Coordinator must run the 40-record fidelity/seed replay and ~200-plan critic
  calibration before claiming empirical readiness. No calibration was invented.
- No production A/B gain, promotion or live cost was measured. README commands
  require explicit approval and approved price bounds. Paid API reservations and
  optional subscription-attempt caps are separate, durable admission policies.
- Sequential A/B promotion requires a predeclared cumulative schedule and justified
  independent-objective/no-interference assumptions. Shared production histories
  and dedup can violate these assumptions. Without them reports block promotion.
- Argon literal-elimination/evidence-gap rates are documented issue-text screens,
  not new semantic verdicts. Full-plan PDE A/B retry/resume is explicitly refused;
  single-section PDE and PMLE are supported.
- Fresh-family held-out judging, complete canaries (at least 20 per defect), and
  blinded human-pair evidence remain required by the report before promotion.

PR #315 stays open and unmerged, stacked on #314. The unrelated untracked root
`operating-plan.md` is not part of this change.
