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
