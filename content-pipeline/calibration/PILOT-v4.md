# Rules-v4 30-item pilot (founder runs; not executed by worker)

Section counts 1–6: 4/5/6/6/5/4. Use a fresh artifact path.

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline

PYTHON_DOTENV_DISABLED=1 uv run python /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/scripts/generate_all_domains.py \
  --cert machine-learning-engineer --n-questions 30 --section-allocation 4,5,6,6,5,4 \
  --model codex --judge-model external --parallel 3 --gen-effort high --cite-effort medium \
  --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/.cache/generation/pmle-d025-v4-pilot-30.json

PYTHON_DOTENV_DISABLED=1 uv run python /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/scripts/judge_requests.py \
  --requests /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/.cache/generation/pmle-d025-v4-pilot-30.judge-requests \
  --verdicts /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/.cache/generation/pmle-d025-v4-pilot-30.verdicts --judge-model claude --parallel 3

PYTHON_DOTENV_DISABLED=1 uv run python /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/scripts/repair_candidates.py \
  --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/.cache/generation/pmle-d025-v4-pilot-30.json \
  --verdicts /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/.cache/generation/pmle-d025-v4-pilot-30.verdicts --parallel 3 --gen-effort high --cite-effort medium

PYTHON_DOTENV_DISABLED=1 uv run python /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/scripts/judge_requests.py \
  --requests /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/.cache/generation/pmle-d025-v4-pilot-30.judge-requests \
  --verdicts /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/.cache/generation/pmle-d025-v4-pilot-30.verdicts --judge-model claude --parallel 3

PYTHON_DOTENV_DISABLED=1 uv run python /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/scripts/ingest_external_verdicts.py \
  --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/.cache/generation/pmle-d025-v4-pilot-30.json \
  --verdicts /Users/switkowski/Projects/Testero/frontend.prime-testero-content/content-pipeline/.cache/generation/pmle-d025-v4-pilot-30.verdicts --dry-run
```

Wait for each phase. Inspect failed generation/judgment records before continuing.
Dry ingestion makes no DB writes. DRAFT write ingestion and founder approval are separate.
