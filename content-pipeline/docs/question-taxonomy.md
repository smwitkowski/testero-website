# Question taxonomy operations — proposed v1

Founder review draft: `../hq/drafts/taxonomy/TAXONOMY.md` from frontend root. Never publish HQ drafts to the site.
Vocabulary: `certs/question-taxonomy.json` —19 decisions,11 constraints,46 product families,10 failure modes; cardinalities1/0–3/0–6/0–3. Migration seeds86 values. Manual primary audit covers450 questions;72 low-confidence cases. Gold25 covers18/19 primaries (no trigger_automation),11 constraints,10 failures and22 product families. No live classifier run occurred; agreement is unknown. Exact-UUID artifact preflight linked138/165 ACTIVE and24/285 DRAFT bank rows to a plan (424 unique plan links overall).

## Preconditions

Founder approves definitions and adjudicates important gold/boundary labels before backfill. Coordinator applies migration `20261019100000_question_taxonomy.sql` after approved merge; worker applied it only locally. Freeze vocabulary and question edits during a run. Re-export immediately before write if any question changed: hashes bind the export, not a live DB snapshot. Never write production without separate authorization.

Run from this worktree’s `content-pipeline/`. Dry classification uses existing authenticated Claude subscription CLI; no DB client or env files. Write mode uses coordinator-injected `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (existing client); never put credentials in command text/logs/commits. Write disables dotenv before importing the existing client. `--model claude` resolves to existing `claude-sonnet-5-5`, not a new cheaper-model guarantee. One call per uncached question, no automatic provider fallback. Pilot first and measure actual cost/quality.

## Gold pilot (25 calls, two status cohorts)

Only coordinator runs these; they have **not been executed against a model**.

```bash
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-taxonomy-1019/content-pipeline
uv run python scripts/backfill_question_tags.py --bank-export ../../hq/drafts/taxonomy/bank-export-2026-10-19.json --artifact-dir ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation --status ACTIVE --model claude --output .cache/taxonomy/gold-active.json --question-id 00649ff6-c21b-5aa2-99f1-6312b906bfe9 --question-id 0992cf85-6f92-5674-b233-ff00fb97c122 --question-id 0ee006ac-b8f2-5ce1-8b6c-8c0c27756cc8 --question-id 16199e25-a779-546d-9b7f-90474f226f4f --question-id 19fd7339-8eca-5703-8cf8-9c84628a663b --question-id 248c6667-2cdf-5b44-9ed4-9c2fcfea04e5 --question-id 2552fa69-5a20-5744-90a3-2c76eba518d2 --question-id 2cd24636-8488-5a41-8d48-d0098bf90046 --question-id 2e3684ad-0dce-5944-9551-0c4be92471fc --question-id 44aa6df6-72d0-548e-a635-4f204425bc7c --question-id 605059a3-044b-586c-a7e3-97f50c804fca --question-id 685450c7-4bed-5375-9db8-378d58afd712 --question-id 1eaba98c-3398-5611-b792-250571905518
uv run python scripts/backfill_question_tags.py --bank-export ../../hq/drafts/taxonomy/bank-export-2026-10-19.json --artifact-dir ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation --status DRAFT --model claude --output .cache/taxonomy/gold-draft.json --question-id 003d2229-5d48-5daf-8a60-7985f55edbb5 --question-id 0168b5cc-7806-5dd2-ad26-465ebd8a51a1 --question-id 333ae8b1-02d1-4ecd-a00f-e70201e1d1c8 --question-id 40c0e4f4-e944-4cd4-9804-2ad3bfa0eefe --question-id 33bd5313-dc6f-4599-9d3d-d13e31219754 --question-id 4f7ee124-a4e1-5a17-b0cd-c2ecb57f622b --question-id 098b917b-bc84-4fe9-8695-497689643229 --question-id 0709fe16-2e3a-5fbf-a3cf-26e80c94de53 --question-id 0ff10f7d-b5e4-59b6-9c8a-a0cce8abddd2 --question-id 1dc5c5f0-c9c6-5a26-a687-03530e2986bd --question-id 27cf498c-5d92-5298-be30-ac61e1144790 --question-id 471afd8e-8d9c-5be7-828c-4d8832722843
```

Review predicted tags against full questions. Set only each file’s top-level `reviewed` to `true` after inspection; preserve metadata/hashes. Then:

```bash
uv run python scripts/evaluate_question_tags.py --predictions .cache/taxonomy/gold-active.json .cache/taxonomy/gold-draft.json --output .cache/taxonomy/gold-agreement.json
```

Evaluator checks reviewed predictions, matching vocabulary/cert/bank hashes, missing/duplicate gold IDs and valid tags. Reports primary exact agreement, per-axis exact sets, micro precision/recall/F1 and disagreement IDs. Empty-set F1 is null, not perfect. Extra non-gold predictions counted/ignored. Gold is purpose-selected single-analyst judgment, not independently founder-adjudicated or proof of pedagogical validity. Inspect all primary disagreements; suggested90% primary/80% constraint exact-set thresholds are review aids only, not proven reliability.

## Full dry run — no DB writes

Keep statuses separate. Resume by repeating the exact command: completed prefixes are reused only if model/vocabulary/selection/every input hash match. Do not resume reviewed files. Conflicting historical plans fail closed; isolate authoritative direct artifact JSON files, never fuzzy match text.

```bash
uv run python scripts/backfill_question_tags.py --bank-export ../../hq/drafts/taxonomy/bank-export-2026-10-19.json --artifact-dir ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation --status ACTIVE --model claude --output .cache/taxonomy/active.json
uv run python scripts/backfill_question_tags.py --bank-export ../../hq/drafts/taxonomy/bank-export-2026-10-19.json --artifact-dir ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation --status DRAFT --model claude --output .cache/taxonomy/draft.json
```

Optional `--limit 25` is a sorted-ID preview, **not gold25**; retain identical limit for write. Repeatable `--question-id UUID` selects exact existing IDs in specified status. Artifact association is exact UUID only, including inserted/repaired-storage IDs. Judge-request subdirectories are not scanned. Every bank field including options, actual is_correct, top-level explanations and doc links is classifier evidence; plans supplement rather than replace final question evidence.

## Reviewed write — separate approval; never classifies

Review complete files and set `reviewed:true`. Never automate that marker during classification. Reuse identical export/model/vocabulary/selection/artifact inputs. ACTIVE first; DRAFT only if authorized:

```bash
uv run python scripts/backfill_question_tags.py --bank-export ../../hq/drafts/taxonomy/bank-export-2026-10-19.json --artifact-dir ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation --status ACTIVE --model claude --write --input-tags .cache/taxonomy/active.json
uv run python scripts/backfill_question_tags.py --bank-export ../../hq/drafts/taxonomy/bank-export-2026-10-19.json --artifact-dir ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation --status DRAFT --model claude --write --input-tags .cache/taxonomy/draft.json
```

The review marker is a human assertion, not a signature. Hashes detect stale inputs, not malicious reviewed-file edits. All records prevalidate before DB client construction. Each question’s complete tag set replaces atomically; replay preserves timestamps for unchanged rows and removes stale memberships. **Whole bank is not one transaction**. Failure reports completed count and stops; same reviewed file can be replayed safely. Generation-owned tags reject later backfill; empty sets have no persistent owner.

## Opt-in generation

Append `--emit-taxonomy` to approved `scripts/generate_pmle_questions.py` command with `--judge-model external`. One additional plan classifier call follows existing decision verification; freezes tags/plan/vocabulary hashes. Default disabled path makes no extra call. `--plan-only` remains offline. No generation/judge prompt, quality threshold or blind-review inputs change.

`ingest_external_verdicts.py` validates and persists source generation before final review completion. Repairs inherit unchanged plan-bound tags. Inspect final-question divergence from plan. If RPC fails after content insert, existing journal marks `failed_partial` and requires human reconciliation; do not blindly rerun ingestion. No new content+tags atomic transaction claimed.

RLS denies browser reads of tags/vocabulary; tags can reveal answers. Service-role-only RPC locks one question and replaces complete set; generation supersedes backfill. Later mastery endpoints must server-join owned answered session items and return appropriate aggregates. No adaptive routing or learner data changes now.

## Verification

```bash
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-taxonomy-1019/content-pipeline
env -i PATH="$PATH" HOME="$HOME" uv run pytest -q
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-taxonomy-1019
env -i PATH="$PATH" HOME="$HOME" CI=true npm test
env -i PATH="$PATH" HOME="$HOME" CI=true npm run lint
env -i PATH="$PATH" HOME="$HOME" CI=true npm run typecheck
env -i PATH="$PATH" HOME="$HOME" CI=true docker build .
```

Local only, under exclusive `~/.cache/testero-qa-lease`: `supabase start`, `supabase db reset --local`, `npm run test:taxonomy:db:local`, `npm run test:db:local`. Taxonomy fixtures roll back. Never reset while someone else holds lease. Generate types only using `supabase gen types typescript --local`; `supabase/database.types.ts` came from local v2 migrations.

Gold/audit fixtures contain UUIDs and short analyst reasons, not the private bank. Failure modes are question-level content labels, not per-option mapping or observed learner misconceptions. Existing difficulty is unchanged; no empirical reasoning-depth scale added. No live model/production write, adaptive routing, question cleanup or new cert launch was included.


## Recorded local evidence (2026-10-19)

- App `npm test`:1183 passed across74 files; lint/typecheck clean.
- Full pipeline latest completed gate:2127 passed,3 skipped,48 subtests passed (25 existing dependency deprecation warnings); final review tests additionally234 passed including repaired tag inheritance/persistence and RPC failure journal.
- Local `supabase db reset --local` succeeded on retry after an initial container-initialization failure; taxonomy permission/replacement/replay/validation/source/rollback verifier and entire existing DB suite passed. QA lease released.
- Docker build succeeded; existing Dockerfile warning about service-role placeholder remains. No live Stripe/model/cloud quality validation is implied.
