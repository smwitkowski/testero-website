# Question Generation CLI

CLI tool for generating LLM-backed PMLE questions for the content pipeline.

## Setup

### 1. Install Dependencies

```bash
cd content-pipeline
uv sync
```

Or manually:
```bash
uv add click supabase python-dotenv dspy-ai openai pydantic
```

### 2. Configure Environment

Create a `.env` file in the project root (copy from `.env.example`):

```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

**Required:**
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for database access
- `OPENROUTER_API_KEY` for generation and the mandatory judge via OpenRouter
- `EXA_API_KEY` and `FIRECRAWL_API_KEY` for documentation search and scraping; without usable documentation evidence the judge cannot pass a question

**Optional - semantic duplicate checks:**
- `OPENAI_API_KEY` enables OpenAI embeddings for semantic duplicate checks. Without it, the program warns and continues without semantic checks. Lexical duplicate checks still run.

**Optional - LangSmith Observability:**
- `LANGSMITH_API_KEY` - LangSmith API key for tracing (get from https://smith.langchain.com)
- `LANGSMITH_PROJECT` - Project name in LangSmith (default: `question-generation`)
- `LANGSMITH_TRACING` - Enable tracing (default: `true`, set to `false` to disable)

When LangSmith credentials are configured, all LLM calls are automatically traced with:
- Input/output data for each generation step
- Execution time and latency metrics
- Error tracking and debugging information
- Hierarchical trace structure showing the full generation pipeline

Tracing is opt-in and gracefully disabled if `LANGSMITH_API_KEY` is not set (no performance impact).

## Usage

Generate LLM-backed questions:

```bash
uv run python scripts/generate_pmle_questions.py \
  --domain-code MONITORING_ML_SOLUTIONS \
  --n-questions 10 \
  --model openrouter/google/gemini-2.5-flash
```

### Options

- `--exam`: Exam identifier (default: `GCP_PM_ML_ENG`)
- `--domain-code`: Domain code (required, e.g., `MONITORING_ML_SOLUTIONS`)
- `--n-questions`: Number of questions to generate (default: 10)
- `--model`: DSPy/OpenRouter model identifier (default: `openrouter/google/gemini-2.5-flash`).
- `--difficulty`: Difficulty level: `EASY`, `MEDIUM`, or `HARD` (default: `MEDIUM`)
- `--prompt-version`: Optional prompt version identifier
- `--notes`: Optional notes about this generation run
- `--dry-run`: Generate questions without inserting into database
- `--skip-invalid/--insert-invalid`: Skip invalid questions (default) or insert with `NEEDS_ANSWER_FIX` status

### Valid Domain Codes

- `ARCHITECTING_LOW_CODE_ML_SOLUTIONS`
- `COLLABORATING_TO_MANAGE_DATA_AND_MODELS`
- `SCALING_PROTOTYPES_INTO_ML_MODELS`
- `SERVING_AND_SCALING_MODELS`
- `AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES`
- `MONITORING_ML_SOLUTIONS`

## Quality gate and founder workflow

Generation never publishes questions. Every insert is `DRAFT` and linked to
`question_generation_runs`. The validator runs on the cleaned text that will be
stored. A separate typed DSPy judge then checks the marked answer, all distractors,
all four explanations, scenario clarity/relevance, and support in the captured
Google Cloud documentation. A pass requires explicit `PASS`, all seven checks true,
and a finite score of at least **0.8 / 1.0**. Missing evidence, uncertainty, malformed
responses, and judge errors fail closed.

The verdict is JSON text in existing `questions.review_notes`, under
`content_pipeline_judge` (version 1, passed, score, reason, model). Complete
judge-passed questions get `review_status=GOOD` but remain `DRAFT`; failures get a
non-GOOD review status. Partial answer/explanation writes cannot finalize GOOD.
No schema migration is needed. `--skip-eval` only skips the legacy research evaluator;
it cannot skip the mandatory quality judge. The judge uses the selected generator
model through a separate per-call DSPy LM, without changing global generation settings.

From the frontend repository root, with service credentials supplied in your local
environment (never commit credentials):

```bash
cd content-pipeline
uv sync
uv run python scripts/generate_pmle_questions.py \
  --domain-code MONITORING_ML_SOLUTIONS \
  --n-questions 20
```

Use the **Generation run ID** printed by that command:

```bash
RUN_ID='<printed-generation-run-UUID>'
uv run python scripts/review_batch.py "$RUN_ID"
```

Open `review/<run_id>.md`. Inspect every sampled stem, option, correct flag,
per-option explanation and judge verdict. The sample is uniform random,
`ceil(10% of eligible questions)`, minimum 1 for a nonempty pool. Only completed
runs and complete judge-passed DRAFT/GOOD questions are eligible. If the pool is
empty, the report contains no questions and approval promotes zero.

If a sampled question has a defect, do **not** approve. Reject/fix that content and
obtain a fresh judge verdict before exporting and reviewing again. Edits made after
export invalidate the report fingerprint.

Only after you have reviewed and accepted the sample:

```bash
uv run python scripts/review_batch.py "$RUN_ID" --approve
# Or explicitly attest human review without an interactive prompt:
uv run python scripts/review_batch.py "$RUN_ID" --approve --yes
```

Approval requires the existing same-run, unchanged spotcheck export; `--yes` is
an attestation, not a bypass. It promotes only that run's judge-passed DRAFT/GOOD
rows to `ACTIVE`, prints counts, and is idempotent. Re-running after successful
approval prints `Promoted: 0`. Review markdown is local and gitignored.

## OpenRouter writer output contract

Decision planning, documentation veto, and question writing default to a 32,000
output-token cap (including reasoning). The Python writer APIs accept a per-call
`max_tokens` override. A provider `length`/`max_tokens` finish remains a terminal
`MaxTokensTruncation`; a larger cap is not evidence that a model will finish.
The separate citation-repair API keeps its existing budget and receipt behavior.

Declare supported parameters explicitly from OpenRouter model metadata before a
comparison run. No model discovery request is made by the writer. For example,
**only after confirming support for your selected model**, supply this JSON map
in the process environment (the name below is an illustrative placeholder):

```bash
export TESTERO_OPENROUTER_MODEL_PARAMETERS='{"vendor/model-id":["structured_outputs","response_format"]}'
```

Either supported parameter selects one schema-enforced JSON call, using the same
strict output schema as Codex. Model keys may include the `openrouter/` prefix.
Unconfigured models use one ChatAdapter call with whitespace-tolerant markers,
then the same strict output model. There is no adapter retry or automatic model
switch after a schema error. Validation failures record only field paths and error
types under candidate `diagnostics.validation_errors`, not input/answer values.
Codex, council judging, and nightly paid-generation prohibitions are unchanged.

## Offline tests

```bash
uv run pytest -q
```

Tests mock Supabase and the LLM, disable dotenv/tracing, and block network sockets.
The existing `shared/test_validator.py` is included in pytest discovery.

## Validation

Questions are validated before insertion:
- Stem must be at least 20 characters
- Exactly 4 choices (A, B, C, D) with non-empty text
- Exactly one correct answer (correct_label matches a choice)
- Explanation must be at least 50 characters

Invalid questions are either skipped (default) or inserted with `review_status='NEEDS_ANSWER_FIX'` for review in the admin panel.

## Verification

The generator prints the generation run ID, draft review states, and counts.
Use `/admin/questions` to inspect the run; successful generation alone never makes
its questions available to learners. The founder review command above is the
publication step. Do not use the stub generator as reviewed production content.

## Writer prompt optimization v2 (offline implementation; coordinator runs live work)

Only generation changes. Proof signatures, schemas, objective policy, rename
lexicon, practitioner rules, five council seats and publishing gates stay frozen.
No pack keeps today's production prompts byte-identical. Plan packs expose:

- `plan.instructions` ≤3,000 characters;
- `plan.distractor_guidance` ≤1,200 characters;
- `plan.repair_guidance` ≤1,200 characters;
- selected, never evolved `exemplars`: at most three accepted **train plans** per
  certification/domain, filtered to the current domain and other objectives.

No full draft/documentation demonstrations are exported. Draft bootstrap is
explicitly retired; use the compact plan arm below. Draft GEPA remains a later,
separate experiment and does not bootstrap full drafts.

`PlanProgram` has named `plan` and `repair` predictors. Only an isolated v6 B–D
veto activates surgical repair. The production guard preserves scenario, key and
passing options. GEPA uses round-robin, minibatch 6, merge off, a guarded custom
proposal function, and a configurable Claude Sonnet reflector. Reflection sees
frozen schemas, names, rules, objective style policies and selected exemplars
read-only. Caps, required positive-fact/stated-constraint reasoning and anti-gaming
lint reject unsafe proposals. Defaults themselves are trusted frozen text, not
new proposals.

### Metric and admission gates

The dataset freezes every saved fetched page per objective, including rejected
attempts, in hash-bound `corpora.json`. Rows use references; loaders validate and
share immutable corpus objects. Ranking recomputes production discovery queries
for each candidate, then uses the production bounded context builder. No live
retrieval or saved proof is substituted for checking a new plan.

The optimization checker uses temperature zero on configurable OpenRouter
transports. Production still defaults to 0.7. Codex exposes no temperature flag;
it uses the unchanged subscription CLI, serial pacing and retry/backoff. Codex
students preserve DSPy's predictor traces, so real GEPA sees plan and repair.

The critic reads the frozen Style decision-design and Argon O3/S13 contract on
an **off-council family**. Anthropic/Claude and Google/Gemini/Argon are refused.
A model/rules/dataset-bound calibration needs ≥200 historical train plans, both
outcome classes and balanced accuracy ≥0.75. Missing, stale, fixture-only or
weaker calibrations fail before calls. Unknown historical outcomes are not labels.
The score is 1.0 when docs and critic pass, 0.4 for docs only, otherwise ≤0.15.
Feedback names failed checks/options and successes, routed to `plan` or `repair`;
reflection reuses cached verdicts rather than buying another check.

Production has **five downstream council seats**: Claude blind/style/evidence
and Argon blind/review. Upstream doccheck is a sixth overall check, not a sixth
council seat. Critic feedback never changes these judges.

### Exact coordinator commands

These are instructions, **not evidence that live calls or gains were measured**.
Run one experiment at a time, after the separate v5/v6 A/B. Never merge or publish
from an optimizer command. Keep private outputs in the ignored cache. No command
below loads `.env`; supply approved credentials only in the process environment.

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-optimize/content-pipeline
export PYTHON_DOTENV_DISABLED=1
export LANGSMITH_TRACING=false
export LANGCHAIN_TRACING_V2=false
ROOT=/Users/switkowski/Projects/Testero/frontend.prime-optimize/content-pipeline
DATA="$ROOT/.cache/optimize/datasets-v2"
PACKS="$ROOT/.cache/optimize/packs"
REPORTS="$ROOT/.cache/optimize/reports-v2"
# Create and approve this local file from scripts/optimize/prices.example.json.
# Its values must upper-bound the actual selected OpenRouter model prices.
PRICES="$ROOT/.cache/optimize/prices-approved.json"
CRITIC=openrouter/deepseek/deepseek-v4.1-flash-1017
REFLECTION=anthropic/claude-sonnet-5.5
mkdir -p "$PACKS" "$REPORTS"
```

**1. Rebuild frozen datasets.** Thirteen dev objectives per canonical
certification leave disjoint train/test objectives. Canary/gold objectives always
stay in test; add `--cohort /ABS/COHORT` for separate protected roots. The builder
refuses insufficient objective counts instead of inventing data. Input paths
below are saved artifact directories, read-only.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.build_datasets \
  /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation \
  /Users/switkowski/Projects/Testero/frontend.pipeline-pilot/content-pipeline/.cache/generation \
  --output-dir "$DATA" --seed 42 --dev-objectives-per-cert 13
```

**2. Fidelity: 40 recorded replays plus 40 unchanged seed rollouts.** This is
approximately 120 serial Codex calls, $0 marginal API spend. Require ≥85% verdict
agreement; inspect seed pass rate against the approximate 40% PMLE dev target.
A low seed rate is a fidelity investigation, not permission to optimize artifacts.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.fidelity \
  --datasets "$DATA" --out "$REPORTS/fidelity-pmle-v6.json" --count 40 \
  --split dev --cert-id machine-learning-engineer \
  --student-model codex --checker-model codex --seed 42 --coordinator-approved
```

**3. Calibrate the off-council critic.** Labels come only from matched historical
plans with known complete council outcomes on train objectives. The command
refuses fewer than 200 usable plans or missing classes. An offline fixture report
cannot authorize the critic.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.calibrate_critic \
  --datasets "$DATA" --out "$REPORTS/critic-deepseek-v2.json" --count 200 \
  --cert-id machine-learning-engineer --critic-model "$CRITIC" --seed 42 \
  --prices "$PRICES" --budget-usd 2 --coordinator-approved
```

**4. Zero-cost rubric + exemplar challenger.** This command makes no model,
retrieval or database calls. O3/O5/O6 are copied verbatim from frozen Style rules,
not paraphrased. It selects up to three other-objective accepted train plans per
domain. Empty positive sets and existing output files are refused.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.zero_cost \
  --dataset-dir "$DATA" --cert-id machine-learning-engineer \
  --output "$PACKS/zero-cost-pmle-v6.json" --doccheck-policy v6 --seed 42
```

**5. Production A/B, generation only.** This is a coordinator-approved production
workflow, **not an instruction to run it during implementation**. Example: domain
1, 40 candidates, frozen adjacent control/challenger pairs within each objective.
Pair order is seeded/randomized; every pair has one candidate per arm. The
challenger changes only generation. All judging and publishing rules are unchanged.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.run_domain_batch \
  1. optimize-rubric-v2 machine-learning-engineer --count 40 \
  --doccheck-policy v6 --prompt-pack "$PACKS/zero-cost-pmle-v6.json" \
  --ab-interleaved --ab-experiment pmle-rubric-v2 --ab-seed 45
```

For the existing nightly configuration, the equivalent additional flags are:
`--prompt-pack "$PACKS/zero-cost-pmle-v6.json" --ab-interleaved
--ab-experiment pmle-rubric-v2 --ab-seed 45 --doccheck-policy v6` on
`scripts.pipeline_nightly`.
A/B mode fixes the objective schedule before outcomes; non-A/B behavior is
unchanged. Full-plan PDE retry/resume A/B is explicitly refused; single-section
PDE and PMLE are supported. Artifacts and digests record candidate arm, objective,
pair, experiment and challenger hash, including failures.

Report a complete chronological prefix (repeat `--artifact` for later batches):

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.ab_report \
  --artifact "$ROOT/.cache/generation/optimize-rubric-v2.json" \
  --canary "$REPORTS/canaries.json" --spot-check "$REPORTS/blind-10-pairs.json" \
  --held-out "$REPORTS/fresh-panel-30.json" --schedule "$REPORTS/ab-schedule.json" \
  --output "$REPORTS/rubric-ab.json"
```

Use the **actual artifact path** printed by `run_domain_batch` in the report
command and schedule; the example name is not an automatically created fixture.
`schedule` is predeclared JSON with `experiment`, `challenger_sha256`, ordered
absolute `artifacts`, `independent_objectives_no_interference: true`,
`pair_horizon: 160`, and
`paired_looks: [{"pairs": 80, "alpha": 0.005}, {"pairs": 160, "alpha": 0.045}]`.
Do not assert this certificate unless it is justified: production histories and
dedup can couple objectives. Without it the report stays descriptive and cannot
promote. `spot-check` binds the same experiment/hash and requires `complete:true`,
`pairs:10`, `losses:<7`, `factual_defects:0`. `held-out` binds experiment/hash and
requires `complete:true`, `count:30`, `gain_persists:true` from fresh model families.
A canary report must prove 100% catch with ≥20 examples per defect type.

The report gives per-arm yield, P(council pass | doccheck pass), seat/guardrail
rates and equal-weight paired objective differences with clustered standard
errors. Its one-sided objective-cluster sign-flip test uses equal-weight
objective means. Only 80 complete pairs (alpha 0.005, look 1) and 160 complete
pairs (alpha 0.045, look 2) can decide. All other prefixes, including >160, are
descriptive; do not keep sampling until significant. The report includes a
cluster-bootstrap 95% interval and the old Hoeffding values as non-deciding
secondary fields. The sign-flip test assumes independent, sign-exchangeable
objective differences under the null; a zero grand mean alone is insufficient. Argon
literal-elimination/evidence-gap screens are explicitly issue-text diagnostics,
not new semantic judges. Generic keys must remain ≤20%; conditional council rate
cannot drop >5pp; literal/evidence/echo/duplicate rates cannot rise. Missing
telemetry, votes, pairs, assumptions or audits blocks promotion through the reused
`promotion_decision` gate. A seat blocks on a drop of at least 10 percentage
points or a one-sided objective-cluster sign-flip p-value at most 0.05. Missing
objective-cluster evidence for an observed drop fails closed. Canary catch must
stay 100%; factual-defect blocks are unchanged. Reports never publish.

### Frozen doc-reality cards (PMLE, opt-in)

These tools do not change the running Experiment A. Cards and both planner
checks are off unless selected explicitly. Do not enable them mid-experiment.
Cards enter only the matching objective's writer instructions, never
`scope["domain_prompt"]` or documentation-check inputs.

Prepare from the two historical generation directories and frozen corpus named
in `scripts/optimize/build_planner_cards.py`, without model or search calls:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.build_planner_cards \
  --prepare-only --output-dir "$ROOT/.cache/optimize/cards"
```

The builder uses only pre-2026-10-26T00:00Z doc-check veto reasons and dated
lifecycle passages. It excludes experiment-tagged/A/B artifacts and canary/gold
objectives. Use repeated `--cohort /absolute/manifest.json` and
`--exclude-objective OBJECTIVE_ID` for any separately stored held-outs. Historical
artifacts without creation timestamps use mtime as a conservative upper bound;
post-cutoff copies are excluded. A card needs at least three vetoed candidates
and each selected coverage claim needs two distinct candidates. Shared product
names alone do not establish repeated claims. The audit retains the exact
associations, input hashes, and dated lifecycle sources.

Remove `--prepare-only` to make at most one tool-disabled Claude CLI call per
eligible objective. No OpenRouter, Exa, or Gemini calls are used. A durable
started marker prevents re-calling an objective, including after failure. Inspect
and freeze the output before an experiment; do not rebuild from its outcomes.
Cards have three sections, at most 1,200 characters, and deterministic text lint.
Coverage gaps describe the supplied pages, not product impossibility.

Emit a standalone v5 card challenger, or add cards to an existing plan pack:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.build_card_pack \
  --cards "$ROOT/.cache/optimize/cards/pmle-planner-cards-v1.json" \
  --output "$PACKS/pmle-cards-v1.json"
# Add --base-pack "$PACKS/zero-cost-pmle-v5.json" for A+card.
```

Use `--prompt-pack "$PACKS/pmle-cards-v1.json" --ab-interleaved` for card vs plain.
For A+card vs A, emit with `--base-pack` and also pass
`--ab-control-pack "$PACKS/zero-cost-pmle-v5.json"` to generation/batch/nightly.
Without `--ab-control-pack`, the control remains the unchanged plain writer.
Both pack hashes bind assignments and analysis; do not mix different control
packs in one experiment. With an explicit control pack, the schedule, blinded
human audit, and held-out audit JSON must also include `control_sha256` matching
that pack. The emitter never overwrites an existing output.

Nightly JSON uses `"prompt_pack": "/absolute/card-pack.json"`,
`"ab_interleaved": true`, an explicit `"ab_experiment"`, and optional
`"ab_control_pack": "/absolute/base-pack.json"`. The control-pack CLI flag and
config key are absent by default. Existing pack files without `lessons` retain
their previous hashes and rendered writer context.

Two separate planner checks can be enabled on generate, batch, or nightly:

| Piece | CLI flag | Nightly JSON key | Effect |
|---|---|---|---|
| Lifecycle/current-name check | `--plan-freshness-lint` | `"plan_freshness_lint": true` | Re-plan before doc fetch within the same three-attempt budget. |
| Scenario-hint cap | `--scenario-hint-cap` | `"scenario_hint_cap": true` | At most three unmapped hints, each sharing two normalized exact-objective tokens. |

Both checks apply to both arms when explicitly enabled. Test them at a new
experiment boundary, separately from the card unless that combination is the
predeclared treatment. Missing/false keys preserve old commands, prompts, and
artifact shapes. Mixed flag settings cannot be pooled in an A/B report.
The schedule, blinded human audit, and held-out audit JSON must bind enabled
checks with `"generation_options": {"plan_freshness_lint": true,
"scenario_hint_cap": false}` (use the actual boolean settings). A missing map
means both checks are off. Reported `generation_options` records the normalized
settings; audit data from a different setting cannot authorize promotion.

Planner-only lifecycle facts are in `certs/product-lexicon.json` under
`planner_products`; the existing learner/v6 `products` list is unchanged.
Retired recommended destinations trigger re-planning. Existing-system and
explicit migration-source mentions remain valid. Renamed names are checked in
`existing_system`, `best_action`, and all mistake actions. Deprecated is not
retired: Optimized online serving has a future sunset and is nonblocking.
Frozen lifecycle entries need review at future experiment boundaries; they do
not silently advance status using the wall clock. All doc checks, independent
judges, and publication gates remain unchanged.

**6. GEPA plan: 250 metric calls, 13 PMLE dev objectives ×3 inputs.**
`--dev-examples 39 --dev-objectives 13` enforces the requested slice. If saved
history lacks enough records, rebuild/inspect it; never duplicate examples to
fake a larger validation set. Minibatch is 6, merge is off, and student/checker
are serial Codex. Sonnet reflects; the calibrated off-council critic scores.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.run_optimizer \
  --stage plan --method gepa --dataset-dir "$DATA" \
  --output "$PACKS/plan-gepa-v2.json" --cert-id machine-learning-engineer \
  --student-model codex --checker-model codex --checker-temperature 0 \
  --critic-model "$CRITIC" --critic-calibration "$REPORTS/critic-deepseek-v2.json" \
  --reflection-model "$REFLECTION" --max-metric-calls 250 \
  --dev-examples 39 --dev-objectives 13 --minibatch-size 6 --seed 42 \
  --doccheck-policy v6 --budget-usd 10 --prices "$PRICES" \
  --subscription-call-cap 600 --allow-live
```

GEPA's own cap is **199**, leaving 39 validation +12 minibatch calls below the
250-call hard limiter. Without explicit `--max-metric-calls`, legacy
`--auto light|medium` resolves to 50/150; the headroom rule can reject undersized
combinations. Optimizer execution is inline: no queued transport outlives a cap.
Test objectives never enter training, reflection, exemplars or the dev slice.

`--subscription-call-cap 600` explicitly separates durable Codex/Claude quota
attempts from the **paid OpenRouter** dollar cap. Every retry consumes an attempt.
Token bounds are logged as quota estimates, not dollar invoices. Without this
flag, legacy nonzero CLI quota valuations still share the monetary ledger.
Paid transport admission uses approved nonzero per-million-token upper bounds,
UTF-8-byte input bounds plus framing, and configured output limits. Provider
retries are disabled. Reservations survive failures and are not refunds or
invoices. The $2/$10 examples are hard local estimate caps, not price promises;
conservative rates may stop sooner. Inspect the ledger before approving more.

**7. Resume.** Repeat the exact GEPA command above with `--resume` appended.
The same output name reuses `plan-gepa-v2.run/run.json`, metric cache/accounting,
GEPA state, paid reservations and subscription attempts. Dataset, selected
exemplars, models, proof policy, calibration hash, signatures, seed, dev slice and
metric settings must match. A changed or foreign manifest is refused. Legacy
v1 stopped runs lack the v2 binding and cannot be safely resumed into v2.
A deliberate paid-cap increase may accompany resume; accounting never resets.
A monetary/quota interruption writes a stopped manifest and no misleading partial
pack. A normally metric-capped GEPA run has reserved headroom and emits its pack.

### Offline evidence

```sh
PYTHON_DOTENV_DISABLED=1 uv run pytest -q
env -i PATH="$PATH" HOME="$HOME" CI=true npm test   # from frontend root
npm run lint                                      # from frontend root
```

Tests use mocks and block network calls. Fidelity fixture mode
`--replay-results PATH` and calibration fixture mode `--predictions PATH` are
marked offline and never count as live calibration or gain evidence. No live
optimization, calibration, fidelity replay or A/B run is required to verify this
implementation. The held-out `scripts.optimize.evaluate_pack` command remains
available for approved full-council paired evaluation; supply a deliberate small
local cap and complete canary evidence, never a blanket multi-thousand-dollar cap.
