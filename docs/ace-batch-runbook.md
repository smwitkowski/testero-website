# ACE batch readiness (Phase 2, D-038)

Depends on Phase 1 PR #262 and its production migration. This PR is stacked on
Phase 1; do not merge Phase 2 first. Nothing here serves non-PMLE questions.

## Offline first

From this repository (no credentials required):

```sh
cd content-pipeline
PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.run_domain_batch 1. ace-plan-20261017 cloud-engineer --count 4 --parallel 2 --plan-only
```

This writes `.cache/generation/cloud-engineer-v5-ace-plan-20261017.json` with the
frozen registry plan and style policies. It does **not** fetch documentation,
export a bank, initialize a database client, run models, create judge requests,
or log fictional model usage. `--dry-run` on the generator is different: it
runs generation and judging while suppressing DB writes. It is not offline.
The `generate_all_domains.py` entrypoint forwards the same flags, including
`--plan-only`. Counts are candidate budgets, not promised accepted questions.

## Coordinator-only live pilot command

After Phase 1 is merged and its migration is applied, use a checkout containing
both PRs. Inject `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, retrieval provider
credentials and `OPENROUTER_API_KEY` through your approved secret mechanism.
`SUPABASE_URL` must be a hosted `<project>.supabase.co` HTTPS origin, without
userinfo, port, path or query. Privileged export requests never follow redirects.
Codex and Claude CLI sessions must already be authenticated. Never paste keys
into a command, report or artifact. The runner does not read `.env`, the Trash,
1Password or gcloud, and does not auto-fetch credentials.

With those variables already injected, the exact small ACE command is:

```sh
TESTERO_PIPELINE_DIR=/Users/switkowski/Projects/Testero/frontend.prime-testero-multicert/content-pipeline N=4 PARALLEL=2 bash /Users/switkowski/Projects/Testero/hq/tools/run-domain-batch.sh 1. ace-pilot-20261017 cloud-engineer
```

The optional third positional argument defaults to `machine-learning-engineer`.
For PCA/PDE later use `cloud-architect` or `data-engineer`, with a fresh tag and
an included standard-guide section (`1.`, `2.`, etc.). The runner picks every
reviewed objective in that section and rotates them using the existing planner.
`N` defaults to 30 and `PARALLEL` to 3; the pilot command deliberately overrides
them to **4** and **2**. These are candidate count and concurrency, not acceptance
or quality guarantees. Use a fresh unique tag for every new generation run.

The authorized HQ wrapper was updated. Its tracked source is
`content-pipeline/scripts/run-domain-batch.sh`; copy it to HQ if checking out
elsewhere, or point `TESTERO_PIPELINE_DIR` at that checkout. The Python runner
is tracked in this PR so the logic is versioned with the pipeline.

## Export and stage safety

- Export ACTIVE+DRAFT rows for exactly the selected exam. Select id, exam,
  status, stem and answer correctness. Order by id, page with limit **500**,
  advance by actual page size, and continue until an empty page. A server cap
  below 500 cannot silently truncate the export. Run batches serially for a
  given cert: REST paging is not a transaction snapshot during concurrent edits.
- A valid empty ACE bank is allowed. HTTP errors, object error responses,
  duplicate IDs, foreign exams and malformed active rows stop the batch. Write
  the final export only after all pages validate. The existing final file is
  not replaced by a failed partial export.
- File names start with cert ID and unique tag: `.json`, `.existing.json`,
  `.judge-requests/`, `.verdicts/`, `.json.calls.jsonl` and `.accepted-ids`.
- Generate with Codex, external Claude judge, mandatory independent Argon,
  `consistent` distractor evidence, high writer effort and medium cite effort.
  Run one judge pass. Any failed command stops the runner immediately, before
  later stages. Failed/rejected candidates do not trigger synthetic verdicts.
- Partial generation/judge failure is inspected manually. Retry the existing
  frozen judge requests using `judge_requests.py`; never regenerate over a
  journal. Run ingest explicitly only after review. Existing ingest journals
  retain their retry/reconciliation protections. No automatic paid-call loop.
- Ingest stores single-select **DRAFT**, never ACTIVE. Founder publication and
  Phase 3 application release are separate approvals. No prod execution was
  performed during implementation.

## Cert scope and gates

New-cert authoring/critic instructions ask for practitioner/engineering rather
than ML-only decisions. Frozen PMLE instructions, reviewed examples and the exact PMLE
ML-practice allowlist stay intact. Every ACE/PCA/PDE objective defaults to no
ML-practice waiver. Registry context carries the cert, domain, objective and
guide hash to the writer/evidence gates. Blind/style inputs preserve their
existing answer/evidence leak boundaries.

The generator validates export provenance for its selected cert; mixed or
foreign banks fail before transports. Non-PMLE rows must carry cert/exam
provenance. Historical PMLE-only exports without provenance retain the PMLE
legacy behavior. Comparison rows preserve cert ID, and explicit foreign certs
cannot veto one another. Plan and final candidate checks use the same unchanged
0.20 similarity threshold. Ingest validates the frozen comparison snapshot,
including cert/objective metadata, before replaying the veto.

Model usage stays in the existing metadata-only call logger. Unknown counts are
null, not zero estimates; no prompts or documents are added to telemetry. The
offline tests exercise fake usage and existing adapters, not billed cost or live
provider completeness. Inspect the batch calls sidecars and token report after
a coordinator-run pilot. No real question quality or yield is established by
these synthetic tests.

Phase 3 serving, multi-select, billing and quota decisions remain only in
`docs/multi-cert-design.md`.
