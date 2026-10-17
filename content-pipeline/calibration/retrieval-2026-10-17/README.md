# Retrieval and distractor-evidence A/B (2026-10-17)

## Change contract

Retrieval is default-on. Exa asks for **3×** the existing per-query successful-source
limit (15 main / 6 per option), bounded even if the provider returns too many.
Dead fetches and final-URL duplicates do not consume the successful-source limit.
Only a real HTTP 404 triggers bounded official path aliases: Vertex AI ↔ Gemini
Enterprise Agent Platform, and Agent Assist → Gemini Enterprise CX. These are
recovery candidates, not proof that every old path has a replacement. Each fetch
still requires approved HTTPS hosts, validates each redirect before transport,
HTML/size limits, and exact fetched-text hashes. No search snippet is evidence.
Official redirects use the existing handler. The current/legacy query aliases are
discovery hints only. Source and retry limits, other than the 3× discovery reserve,
are unchanged. More successful sources can increase verification input tokens.

`--distractor-evidence strict` is the default. Its prompt classes are unchanged.
`consistent` selects **Distractor evidence consistent v1** decision-proof and
evidence-review signatures only. The key needs direct decisive quote support.
Distractor reasons may use clear scenario/documented-behavior inference, but not
silence-as-limitation, contradictions, unsupported speculation, or a second
credible answer. A–D exact receipts, hashing, factual checks and thresholds remain.
Blind solver, style, Argon, writer/citer and planning prompts are unchanged.

New batches freeze `distractor_evidence: {version: 1, mode: ...}` on batch,
every planned scope/candidate/proof, judge request, verdict envelope and grounding.
No ingest/export/judging override exists. Mismatches and missing copies reject;
fully historical absent metadata remains strict. Repairs inherit the mode.
Verdict metadata is outside the per-gate output schemas.

See [MEASUREMENTS.md](MEASUREMENTS.md) for artifact counts and their limits.
`url-inventory.json` contains deduplicated observed requested/final URL changes.
The reported URL changes are not recorded HTTP status/hop counts. Historical
artifacts lack discovery/failure records; adding persisted fetch diagnostics is
separate follow-up work. No model quality/yield improvement is claimed offline.

## Coordinator commands — live, not executed by this worker

Assumptions: use this branch for **both arms**, an already-authorized environment
with Exa and subscription/cloud access, and the **same frozen ACTIVE/DRAFT export**
as the prior A/B. Do not read credentials from files or use a production DB.
`PYTHON_DOTENV_DISABLED=1` prevents dotenv loading. `BANK` below is an explicit
coordinator-supplied path, not a new export operation. Use fresh output paths;
never overwrite prior batches. Both arms use seed 1710, parallel 1, high generator
and medium cite effort, short-circuit judging and unchanged Argon. N=12 is the
**total per arm**, round-robin 3 per objective, not 12 per objective.

Objectives: 1.1:5 fine-tuning Gemini/BigQuery; 6.1:1 LLM security; normal controls
5.1:1 validating data/models and 6.2:1 Model Monitoring. The controls are selected
as ordinary workflow coverage, not evidence that they are easier or stable.

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-retrieval
git switch prime/pipeline-retrieval
cd content-pipeline
export PYTHON_DOTENV_DISABLED=1
export BANK=/ABSOLUTE/PATH/TO/THE/SAME/FROZEN-ACTIVE-DRAFT-EXPORT.json

uv run python scripts/generate_all_domains.py --cert machine-learning-engineer \
  --n-questions 12 --seed 1710 --parallel 1 --gen-effort high --cite-effort medium \
  --objective machine-learning-engineer:standard:1.1:5 \
  --objective machine-learning-engineer:standard:6.1:1 \
  --objective machine-learning-engineer:standard:5.1:1 \
  --objective machine-learning-engineer:standard:6.2:1 \
  --model codex --judge-model external --argon-gate --existing-questions "$BANK" \
  --distractor-evidence strict --artifact .cache/generation/ab-retrieval-strict.json

uv run python scripts/generate_all_domains.py --cert machine-learning-engineer \
  --n-questions 12 --seed 1710 --parallel 1 --gen-effort high --cite-effort medium \
  --objective machine-learning-engineer:standard:1.1:5 \
  --objective machine-learning-engineer:standard:6.1:1 \
  --objective machine-learning-engineer:standard:5.1:1 \
  --objective machine-learning-engineer:standard:6.2:1 \
  --model codex --judge-model external --argon-gate --existing-questions "$BANK" \
  --distractor-evidence consistent --artifact .cache/generation/ab-retrieval-consistent.json

uv run python scripts/judge_requests.py \
  --requests .cache/generation/ab-retrieval-strict.judge-requests \
  --verdicts .cache/generation/ab-retrieval-strict.verdicts \
  --argon-gate --parallel 1 --full-gate-sample 5
uv run python scripts/judge_requests.py \
  --requests .cache/generation/ab-retrieval-consistent.judge-requests \
  --verdicts .cache/generation/ab-retrieval-consistent.verdicts \
  --argon-gate --parallel 1 --full-gate-sample 5

uv run python scripts/ingest_external_verdicts.py \
  --artifact .cache/generation/ab-retrieval-strict.json \
  --verdicts .cache/generation/ab-retrieval-strict.verdicts --dry-run
uv run python scripts/ingest_external_verdicts.py \
  --artifact .cache/generation/ab-retrieval-consistent.json \
  --verdicts .cache/generation/ab-retrieval-consistent.verdicts --dry-run
```

Generation/ingest may exit nonzero for rejected candidates; inspect artifacts,
not just shell exit codes. Do not remove `--dry-run` from ingest. Compare decision
vetoes and evidence/Argon outcomes by objective; blind-review passing content for
unsupported distractor claims. Report written/accepted counts and tokens per
accepted item, not just a higher write yield. N=12 is directional, not a quality
proof. Retrieval is shared, so this isolates the semantic flag, not retrieval lift.

## Offline gate

```sh
cd content-pipeline
env -i PATH="$PATH" HOME="$HOME" uv run pytest -q
```

HTTP fixtures contain public status/content-type/Location plus a reduced real
article excerpt; cookies/request IDs and full pages are excluded. Their capture
is separate from historical A/B measurements. Tests block sockets and model CLIs.
