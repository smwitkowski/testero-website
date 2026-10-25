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

## Writer prompt optimization (offline harness; coordinator runs live work)

Only writer instructions and train-only demos can change. Proof/veto, Style,
Evidence, Blind Solver and Argon signatures are frozen. A pack is versioned JSON
with stage, canonical base-signature hash, policy, source run and metric scores.
Unknown/judge targets, stale hashes and invalid typed demos fail closed.
`--prompt-pack PATH` works on Codex and OpenRouter; no flag (or an empty pack)
keeps today's prompts byte-identical. Practitioner, v6 and repair guards still
apply after optimized base instructions. A pack's declared runtime policy must
match the generator. This branch is stacked on doccheck PR #314; choose `v5` or
`v6` explicitly and do not use optimization to decide that A/B test.

**Production facts:** doccheck uses the selected **writer model**, not Claude.
`--checker-model` can override its transport without changing the proof rubric.
There are **five downstream council seats** in this checkout: Claude
blind/style/evidence and Gemini Argon blind/review. The upstream proof is a sixth
check overall, not a sixth council seat. Evaluation uses every real seat and
`full_gate_sample=1`; it does not invent a new judge. Historical Argon v1/v3
records qualify as demos only when all five seats pass and recorded provenance
validates. Review-only v2 and missing/skipped seats do not qualify.

Run from the worktree's `content-pipeline` folder. All paths below are absolute.
No command reads `.env` files. Supply approved credentials in the process
environment only for explicitly approved live commands; never store them in
packs, datasets, prices or reports. Keep outputs local and uncommitted.

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-optimize/content-pipeline
export PYTHON_DOTENV_DISABLED=1
export LANGSMITH_TRACING=false
export LANGCHAIN_TRACING_V2=false
DATA="$PWD/.cache/optimize/datasets"
PACKS="$PWD/.cache/optimize/packs"
PRICES="$PWD/scripts/optimize/prices.example.json"
STUDENT=deepseek/deepseek-v4.1-flash-1017
REFLECTION=anthropic/claude-sonnet-5.5
```

`prices.example.json` contains **illustrative conservative values, not verified
provider prices**. Before live work, copy it to an approved local prices file,
verify that each value upper-bounds the applicable model price, and set `PRICES`
to that file. Add a row for every override model. Both input/output rates must
be finite and strictly positive, including subscription CLI quota valuations;
missing prices stop before the call. Never assume a free or zero-cost model.
Each rate is USD per **1,000,000** tokens. Reservations use UTF-8 byte input
bounds plus 4,096 framing tokens and the configured output cap. Reflection,
judges and each explicit CLI retry share the same durable local ledger. Opaque
provider retries are disabled. Reservations are not refunded on failure.
CLI output uses a configurable 131,072-token **estimate**, because the existing
subscription transport has no enforceable output-token flag. The cap is a hard
cap on the local conservative estimate, not an invoice guarantee.

### Exact coordinator commands

Build deterministic objective-disjoint splits and a hashed manifest. Whole
canary/gold objectives are held out of train. Pass `--cohort /ABS/COHORT` for
separate council-health gold/canary roots. Test stems and prior-scenario text
cannot enter demos, even when copied under another objective. Malformed or
unverifiable records are counted and excluded, never repaired into positives.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.build_datasets   /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation   /Users/switkowski/Projects/Testero/frontend.pipeline-pilot/content-pipeline/.cache/generation   --output-dir "$DATA" --seed 42
```

Bootstrap a draft pack with **zero model calls** (DSPy `LabeledFewShot`). Select
four diverse fully accepted train demos per domain, or all available when fewer
exist. An empty positive set stops the command. Inspect the manifest/counts;
there is no invented minimum sample size or automatic leakage fallback.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.run_optimizer   --stage draft --method bootstrap --bootstrap-mode labeled   --dataset-dir "$DATA" --output "$PACKS/draft-bootstrap-v1.json"   --student-model "$STUDENT" --cert-id machine-learning-engineer --demos-per-domain 4 --seed 42   --doccheck-policy v5 --budget-usd 5 --prices "$PRICES"
```

For generated `BootstrapFewShot` demos, replace `--bootstrap-mode labeled` with
`--bootstrap-mode generate --allow-live` and approve its spend cap. It uses the
same frozen metric and strict writer adapter as GEPA, not self-judged answers.

GEPA plan and draft runs require separate explicit approval. The default plan
metric gives partial credit for the four production semantic flags, with full
credit only after mechanical receipts and all production checks pass. Draft
feedback comes from unchanged Claude Style; `--include-evidence-metric` also
requires unchanged Evidence and caps any failed required critic below pass.

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.run_optimizer   --stage plan --method gepa --dataset-dir "$DATA"   --output "$PACKS/plan-gepa-v1.json" --student-model "$STUDENT" --cert-id machine-learning-engineer   --reflection-model "$REFLECTION" --auto light --max-metric-calls 50   --doccheck-policy v5 --seed 42 --budget-usd 50 --prices "$PRICES" --allow-live

PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.run_optimizer   --stage draft --method gepa --dataset-dir "$DATA"   --output "$PACKS/draft-gepa-v1.json" --student-model "$STUDENT" --cert-id machine-learning-engineer   --reflection-model "$REFLECTION" --include-evidence-metric   --auto medium --max-metric-calls 100 --doccheck-policy v5 --seed 42   --budget-usd 100 --prices "$PRICES" --allow-live
```

`--auto light|medium` resolves to 50/150 metric calls unless the explicit
`--max-metric-calls` wins. DSPy 3.0.4 receives exactly one concrete cap, never
both its incompatible `auto` and cap settings. A second local limiter stops
before excess calls. DSPy evaluation runs inline (no queued workers can outlive
a cap stop). Each run uses one certification and recorded proof policy;
practitioner/v6 guards are applied per call, not tuned or duplicated in a pack.
The spend cap applies to all transports, independently of
the metric count. A stopped run writes `PACK.run/run.json`, exits nonzero and
does **not** emit a partially optimized pack. Optimizer test objectives are never
scored, reflected on or used as demos. GEPA uses a deterministic objective-balanced
dev slice (default `min(12, max_metric_calls // 5)`; override `--dev-examples` up
to half the cap), leaving room for baseline and candidate comparisons. Duplicate
reflection requests reuse the same cached score/feedback, not another paid judge
call. Existing optimizer run directories are refused, including stopped runs,
so GEPA cannot resume state from a different dataset under a new manifest.

Paired held-out evaluation runs production plan → proof → draft → full council
on each held-out objective, with/without a single pack. Each pair uses the same
writer selector, seed and **frozen saved documentation**; model output itself
is not guaranteed deterministic. The CLI validates the universal objective
manifest, then selects test objectives for the pack’s declared certification.
Use new output directories for each run.
OpenRouter evaluation and the Codex transfer check:

```sh
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.evaluate_pack   --datasets "$DATA" --prompt-pack "$PACKS/plan-gepa-v1.json"   --model "openrouter/$STUDENT" --seed 42 --doccheck-policy v5   --out "$PWD/.cache/optimize/eval-openrouter-v1"   --prices "$PRICES" --budget-usd 1500 --coordinator-approved

PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.optimize.evaluate_pack   --datasets "$DATA" --prompt-pack "$PACKS/plan-gepa-v1.json"   --model codex --seed 42 --doccheck-policy v5   --out "$PWD/.cache/optimize/eval-codex-transfer-v1"   --prices "$PRICES" --budget-usd 3000 --coordinator-approved
```

Repeat with a draft pack to test its effect; do not silently combine independently
tuned stages. JSON/Markdown reports show doccheck attempt/candidate pass rates,
all-council and per-seat pass rates, and accepted questions per **1M actual writer
input+output tokens**, including proof and failed attempts. Missing token counts
stay unknown and block promotion. Use `--canary-artifact /ABS/ACCEPTED-FROZEN-ARTIFACT.json` to supply a genuinely
accepted artifact for the exact isolated `council_health prepare/live/evaluate`
commands printed in every report (evaluation artifacts are not marked accepted).
After an approved canary run,
pass its complete report through `--canary-report /ABS/REPORT.json` on a new
paired evaluation. No promotion is allowed without a complete 100% canary catch.
Promotion also requires improved held-out all-council pass rate and **no seat
regression greater than 5 percentage points**. A local report never deploys or
publishes anything.

### Cost planning (not live measurements)

| Command | Calls / expected local estimate | Hard estimate cap in commands above |
| --- | --- | ---: |
| Dataset build | none, $0 | not applicable |
| Labeled draft bootstrap | none, $0 | $5 (unused) |
| GEPA plan | student + proof + reflection; token/data dependent | $50 |
| GEPA draft | student + Claude Style/Evidence + reflection; quota valued | $100 |
| Paired OpenRouter held-out eval | both arms, all real council seats | $1,500 |
| Paired Codex transfer | both arms; Codex/Claude quota valued, Argon paid | $3,000 |

Concrete planning example using the illustrative rates and a **20,000-token
input upper bound**: a 32,000-output student reservation is $1.48; a same-sized
reflection reservation is $4.50; one Claude/Codex CLI call with the default
131,072 output estimate is $16.884. These are deliberately conservative per-call
reservations, not likely invoices. Actual corpus size, proof retries and prompt
length set the run estimate. The CLI cap can stop well before the metric cap;
review the durable spend ledger and approve a new cap deliberately rather than
resetting it. No live optimization/evaluation was run to create this harness.

Offline proof:

```sh
PYTHON_DOTENV_DISABLED=1 uv run pytest -q
```
