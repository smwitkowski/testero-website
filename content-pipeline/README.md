# Question Generation CLI

CLI tool for generating LLM-backed PMLE questions for the content pipeline.

## Setup

### 1. Install Dependencies

```bash
cd question-generation
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
- `OPENROUTER_API_KEY` for LLM question generation via OpenRouter

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
  --model openai/gpt-4o
```

### Options

- `--exam`: Exam identifier (default: `GCP_PM_ML_ENG`)
- `--domain-code`: Domain code (required, e.g., `MONITORING_ML_SOLUTIONS`)
- `--n-questions`: Number of questions to generate (default: 10)
- `--model`: OpenRouter model identifier (default: `openai/gpt-4o`). Examples: `openai/gpt-4o`, `anthropic/claude-3-opus`, `google/gemini-pro-1.5`
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

## What It Does

1. Connects to Supabase database
2. Validates the domain code exists and loads domain context
3. Creates a `question_generation_runs` record
4. For each question:
   - Searches for relevant Google Cloud documentation
   - Generates question using LLM (DSPy with OpenRouter)
   - Validates question against quality rubric
   - Inserts question with:
     - Status: `DRAFT`
     - Review status: `UNREVIEWED` (if valid) or `NEEDS_ANSWER_FIX` (if validation fails)
     - 4 answer options (A-D) with one marked correct
     - Comprehensive explanation text
5. Updates the generation run with final counts and completion timestamp

## Validation

Questions are validated before insertion:
- Stem must be at least 20 characters
- Exactly 4 choices (A, B, C, D) with non-empty text
- Exactly one correct answer (correct_label matches a choice)
- Explanation must be at least 50 characters

Invalid questions are either skipped (default) or inserted with `review_status='NEEDS_ANSWER_FIX'` for review in the admin panel.

## Verification

After running, verify in the admin UI:

1. Navigate to `/admin/questions`
2. Filter by domain code
3. Filter by generation_run_id (shown in script output)
4. Questions should appear with status `DRAFT` and review status `UNREVIEWED`
5. Questions are NOT served to users (DRAFT status prevents this)
