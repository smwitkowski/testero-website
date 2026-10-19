# Verified-parent variants: offline handoff (2026-10-19)

## Scope and quality bar

Opt-in only. Default `generate_variants.py` renders prompts without any model,
retrieval or DB call; `--enable-variants` authorizes one writer call per attempt.
It skips plan, verify and cite calls. Round 4 permits one small option-only length
repair when the key is uniquely shortest and no unrelated check fails; no scenario
regeneration or general repair loop. Unknown or interrupted attempts remain consumed;
use a fresh artifact basename.

Parents must be accepted persisted originals, current rules v5, with passing
saved independent gates and verified decision/evidence. Selection validates the
original completed journals and hash-locked requests offline. Each frozen parent
retains run identity, cohort IDs and rebuilt-request digest; replay rechecks them.
An explicit ACTIVE publication snapshot must match ID, stem, key and every
alternative. This is snapshot status, **not current production status**.
Historical exports omit rationales: independently judged artifact rationales are
authoritative; live explanation equality is not established. When snapshot
rationales are supplied their option associations must match.

Every candidate retains the same skeleton, fetched sources and canonical A-D
receipts. The writer rewrites explanations without changing their logic. New
unsupported product claims or changed constraints are a rejecting condition for
existing evidence and Argon reviews; this is semantic model enforcement, not a
perfect deterministic detector. Blind solver gets no parent/key/explanations.
All variants require Claude style/evidence/blind **and Argon** (no production
sampling relaxation). Existing deterministic shuffle and ingest key balancing
retain receipt/rationale associations. Family (parent + siblings) stem Jaccard must be **<0.45** by default
(`FAMILY_STEM_THRESHOLD`, configurable `--family-stem-threshold`). Key similarity
is reported, not gated within a family. The **non-family** bank veto remains
unchanged: `min(stem, key) >= 0.20`. Each variant reports maximum family stem
similarity. Supplied bank exports may carry `parent_question_id` to recognize
published siblings; rows without family metadata conservatively remain non-family.
Merely renaming the parent still fails. Threshold and sibling checks are frozen
and revalidated through generation, rejudge, report and ingest.

Lineage persists under existing `review_notes.grounding.parent_question_id` and
`.variant`; no new DB column or migration is needed. The app must later cap
variants per decision and avoid showing consecutive siblings. That app work is
not included. Do not publish variants until the coordinator/human quality gate.

## Offline evidence

`offline-estimates.json`: 3 real parents ×3 prompts, **135,864 estimated writer
input tokens**, mean 15,096. All-six-domain prepare: 18 prompts, **313,905**.
Heuristic `ceil(prompt characters / 4)`, not a tokenizer/provider measurement.
No writer output, independent review tokens or rejection cost is estimated;
**no ≥5× cost or unchanged-quality claim is established**. Prompt bodies and
frozen source snapshots stay in ignored `.cache/variants/`, never site content.

Reproduce three-parent rendering from `content-pipeline/` (fresh basename):

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/generate_variants.py \
  --parent-artifact ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation/pmle-d033-v5-lowcode-30-b21.json \
  --parent-id a23ed85e-042b-5eaf-ba0d-ccf52b149bd8 \
  --parent-artifact ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation/pmle-d033-v5-collab-30-b24.json \
  --parent-id 2552fa69-5a20-5744-90a3-2c76eba518d2 \
  --parent-artifact ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation/pmle-d033-v5-monitoring-30-b27.json \
  --parent-id 532fb45c-7f86-542a-a470-39ad0df5d199 \
  --existing-questions ../../frontend.prime-testero-pipeline/content-pipeline/.cache/generation/machine-learning-engineer-v5-b28-scaling-1018.existing.json \
  --artifact .cache/variants/dry-three.json
```

Diversity measured offline is presentation-slot uniqueness (three distinct
openings/moments per parent). Actual stem/setting/sibling diversity and quality
need generated variants; report provides those scores, not fabricated dry-run
stem scores. Tests cover rename rejection, strict sibling/bank checks, receipt
association, parent run/request binding, mandatory review, blind isolation,
request/ingest replay, grounding lineage and usage-null accounting.

## Coordinator-only live comparison

Six explicit locally ACTIVE parents across all PMLE domains are frozen in
`scripts/variants_ab.py:PARENTS`; recent means latest locally joined batch per
domain. b28 parents are excluded because no local ACTIVE export includes them.

Offline prepare (replace `run --allow-live` with `prepare`) is safe. Exact live
command, **not run by this worker**, with existing model credentials supplied by
the coordinator's normal environment (no env-file loading):

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline && PYTHON_DOTENV_DISABLED=1 uv run python scripts/variants_ab.py run --allow-live --parent-dir /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline/.cache/variants/ab-six-live.json
```

Run uses Codex low effort, one write ×18, Claude style/evidence/blind, Argon review
on all candidates (`full_gate_sample=1`), then offline report. It never calls
persistence/DB. Re-report with mode `report --artifact <same path>`. Requests,
verdicts and combined writer/judge `.calls.jsonl` are alongside the artifact.
If generation yields no eligible requests, inspect the artifact and use report;
do not regenerate silently. For judge failures use the existing selected-candidate
recovery command in PROCESS.md with **same cohort and `--full-gate-sample 1`**.

Report includes all attempt/rejection costs, usage coverage/nulls, all-gate pass
rate (not publication), gate denominators/skips, Argon REVISE, blind correctness,
parent/sibling Jaccard scores and up to 3 passing pairs for human review. Missing
verdicts cannot pass. Provider usage absent on any row keeps final cost null.
Report's `input_tokens + output_tokens` matches historical report convention;
Claude cache-read/creation categories may be separate. Do not infer full
cache-inclusive traffic, or comparable savings without auditing those receipts.

Historical references (not a paired fresh control):
- `hq/drafts/ab-2026-10-17/RESULTS.md`: A/B1 4.36M baseline vs 3.22M treatment
  all-model tokens per gate-pass. A/B2 strict 2.91M/3 vs consistent 2.57M/5.
- b28: 8.67M **generation-only** /8 accepted =1.084M each; excludes judges.
- Founder 790k lower reference: target ≤158k total tokens per accepted at 5×.

Denominators/scopes differ. Compare generation-only stages to b28 generation,
all-model totals to A/B totals. Saving factors are indicative historical ratios,
not causal A/B evidence. Approve only after a complete usage audit, ≥5× target
check, all invariant gates and human comparison of the 3 pairs.

## Recover the existing 18-variant A/B (no regeneration)

Coordinator reported 587,568 writer input/output tokens across all 18 questions;
the original 0.20 policy rejected all before independent gates. That is not
acceptance or quality evidence. The approved change uses **family stem <0.45**;
non-family bank policy stays strict.

Exact coordinator-only command (not run live by this worker):

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline && PYTHON_DOTENV_DISABLED=1 uv run python scripts/variants_ab.py rejudge --allow-live --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline/.cache/variants/ab-six-live.json --family-stem-threshold 0.45 --review-pairs 3
```

`rejudge` validates existing frozen lineage/evidence and any existing request
before changing the threshold. It recomputes schema and family/non-family
similarity for the complete cohort, rebuilds hash-locked requests and archives
prior verdicts with the existing exporter. No writer, planner, retrieval or DB
call. The recovery path targets schema-valid stored questions; a linked request
whose stored question no longer passes schema validation fails closed. All eligible IDs run style → evidence against parent → blind → Argon with
`full_gate_sample=1`, even when an earlier quality gate fails. Provider errors
can still stop execution; inspect failure receipts, not just report counts.

Writer telemetry remains in the original `.calls.jsonl`; new gate calls append
there. Report fills `tokens.tokens_per_gate_pass` and historical saving factors
when at least one question passes and all expected usage is present. Zero passes
or missing usage correctly leaves these null, not zero or fabricated savings.

`--review-pairs 3` writes `<artifact-stem>.pairs.md`: full parent and variant stems,
stored A-D options and keys, plus maximum family stem score. Pairs are drawn from
three different families, including candidates awaiting/failed review; they are
not silently labeled accepted. Use `pairs --artifact <path> --review-pairs 3` to
write the Markdown offline without rejudging; `--pairs-output <path>` overrides
its location.

Offline replay on an untouched-question copy of the real cohort produced
**15 eligible requests /18**, with **3 retained family rejections** (see
`rejudge-preflight.json`; full founder pairs are in `review-pairs.md`; maximum
family stem Jaccard 0.50685). All 15 requests fit the unchanged 150,000-character
limit (max 147,224) by including parent stem + complete decision plan instead of
repeating full parent rationales/proof in review context. Frozen source windows,
all evidence and every independent rubric are unchanged. No live judgments were
run by the worker.

## Founder feedback: industry-only scenarios (2026-10-19)

The earlier `review-pairs.md` is **rejected historical feedback evidence**, not an
approved new sample. Do not rejudge/reuse its named-organization variants. Fresh
variant plans now contain a deterministic `industry` slot. Parent-ID rotation
spreads first choices across families; each family excludes recognized parent
domain cues and gets distinct sibling industries. Writer `industry` must match
the exact frozen slot; ingest recomputes that slot and rejects repeated family
industries. The 12-industry vocabulary and <0.45 family threshold are unchanged.
See `industry-preflight.json` for all 6 ×3 assignments (18 offline prompts).

Writer instructions require generic industry/domain framing, not invented company,
organization, team or project names (including acronyms/aliases). Industry and
sibling content stays in the existing dynamic diversity input after the stable
instructions and parent context; no per-question data is added to the reusable
system prefix. Offline tests compare that prefix across changed industry/siblings.

The variant-only schema check masks exact registry product spans and a fixed
technical vocabulary, then rejects unexplained capitalized names, organization
naming clauses and common name-as-subject patterns. It runs before expensive
judges, and is rechecked during request building, export, rejudge and ingest.
It deliberately does not change schema policy for original questions or require
an entity model/API. This cheap heuristic is not exhaustive: ambiguous
sentence-leading words, lowercase aliases and parent-domain synonyms can escape.
Parent cue exclusion is also heuristic; the six-parent allocation receipt was
reviewed against their water utility, transit, parcel logistics, municipal
recordings, insurance and property-maintenance contexts. Full semantic compliance remains a
writer + independent evidence/Argon review + founder review responsibility.

Coordinator-only **fresh generation + all eligible independent gates in one go**:

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline && PYTHON_DOTENV_DISABLED=1 uv run python scripts/variants_ab.py run --allow-live --parent-dir /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline/.cache/variants/ab-six-industry-live.json --family-stem-threshold 0.45 --review-pairs 3
```

Use a fresh basename if that artifact exists. `run` writes one variant per slot,
then judges eligible generated questions with style/evidence/blind/Argon and
`full_gate_sample=1`, writes usage/acceptance reports and 3 complete review pairs.
It is **not** a separate `rejudge` invocation: old questions cannot have their
industry/organization content corrected without regeneration. No live calls
were made for this change. Cost and unchanged-quality targets remain unproven.


## Round 3: fresh options and industry realism

Use fresh generation, not rejudge of historical rejected questions. The writer
sees parent stem and frozen receipts, with the complete verified decision plan
and scenario reasons in the stable domain context; parent option sentences are
not supplied as rewrite templates. Each canonical matched A-D option is checked
with the existing normalized token-set Jaccard, strictly **<0.65**. A copy of any
key or distractor rejects before judges; export/ingest independently recompute
the check. A uniquely shortest key also rejects (ties allowed); frozen key-length
hints now use rank 2 rather than rank 1, constant across siblings to retain
parent-prefix reuse.

Evidence and Argon review explicitly fail a moment/want conflict, implausible
industry/task/data granularity, or a distractor that gains merit after a domain
swap. They require each explanation's losing reason in the new industry. These
are semantic judge checks, not a claim of deterministic semantic classification.
Blind solving remains isolated from parent/answer hints.

Industry vocabulary is now **30**, allocated deterministically across the whole
frozen batch with distinct family industries and at most **2 uses per industry**.
Parent-domain cue exclusions remain heuristic. Sibling-aware option balancing
groups siblings before cycling the four keys, both after generation and over the
final accepted/ingest population. Three siblings receive different letters; the
18-candidate batch has 4/5 of each letter. Smaller accepted subsets are balanced
again. A <=40% cap is impossible with only 1 or 2 accepted questions; the report
shows actual counts rather than hiding that limitation. No canonical judged
content, evidence binding or frozen request digest changes during label shuffles.

Family stems remain strictly <0.45, non-family policy unchanged. Industry-only
framing, no-name gate, stable-prefix ordering, full independent gates and Argon
remain mandatory. Offline `round3-preflight.json` records the same six ×3 plan:
1 maximum industry use, 309,524 estimated writer input tokens
(character-based, not provider usage). No round-3 quality/cost result exists yet.

Coordinator-only command (NOT executed by this worker):

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline && PYTHON_DOTENV_DISABLED=1 uv run python scripts/variants_ab.py run --allow-live --parent-dir /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation --artifact .cache/variants/ab-six-r3-live.json --family-stem-threshold 0.45 --review-pairs 3
```

The artifact basename must be fresh. This writes one candidate per slot, runs all
independent gates on every eligible candidate (`full_gate_sample=1`), then writes
token/rejection reports and three full parent/variant review pairs. Human quality
review and the complete all-model token audit are still required to establish
quality parity and >=5× savings. No live calls, merge or production writes.


## Round-3 failed-attempt diagnostics

The coordinator's stored run passed schema13/18;7/18 passed all gates. Its7
failed writer attempts previously stored only `status: failed`. Offline recovery
from canonical stored outputs identifies:

| Failed indices | Check | Measured values |
| --- | --- | --- |
|3,4,8,9,15|Key uniquely shortest|A/B/C/D words:25/26/27/27;21/22/22/23;29/31/32/30;30/31/32/31;30/32/33/31|
|11|Family stem duplicate|0.4857142857142857 >=0.45|
|12|Family stem duplicate|0.4507042253521127 >=0.45|

No option Jaccard, name-detector, or industry-assignment failures in these7.
Shortest-key rejection is not a key-letter balancing failure. All four matched
option Jaccards and canonical word counts are retained per failed attempt in
`round3-failure-breakdown.json`. Base schema independently passes all7; the saved
aggregate schema errors combined option-rewrite and shortest-key language. The
family failures use the **saved generation-time cohort**, not later siblings.
Index12 matches index11, itself rejected; this preserves existing policy rather
than silently changing the threshold or sibling population. Duplicate checks
were not reached for the five schema rejects.

Future failures now record `candidate_id`, `failure_stage`, `reason`,
`error_class`, `failed_checks`, and detailed `failure_checks` on the attempt.
Stages separate writer/schema/lineage/near_duplicate/request. Provider error
bodies are never copied. Missing stored output is explicitly unresolved; no
reason or verdict is fabricated.

Offline preview/backfill (no generation, judge, API, or DB calls):

```sh
PYTHON_DOTENV_DISABLED=1 uv run python scripts/backfill_variant_failures.py --artifact .cache/variants/ab-six-r3-live.json
PYTHON_DOTENV_DISABLED=1 uv run python scripts/backfill_variant_failures.py --artifact .cache/variants/ab-six-r3-live.json --write
```

`--write` holds the artifact lock, saves an exclusive exact-byte backup as
`ab-six-r3-live.before-failure-backfill.json`, and updates only failed-attempt
metadata. Repeating it without changes is a no-op. This artifact was backfilled
offline; candidates, plan, frozen parents, decisions and all26 request/verdict/
usage files are unchanged. No new acceptance, model calls, merge or prod writes.


## Round 4: length repair, strict variant style, and prior-run diversity

The round-3 cost/latency slots (3, 6, 9, 12, 15, 18) went 0/6 for **three length
failures, one family duplicate, one style failure and one Argon moment failure**.
Only #6 was gate-rejected for an incoherent discovery story. #9 also combined two
problems and #15 had a weak cost wrapper. Replacing the forced slot does not prove
six recovered passes. New presentation policy 4 omits forced cost/latency reduction;
scale growth is the third slot for these six parents. The prompt requires one
observed problem, its concrete observation channel and one want addressed by the
key. Historical policy-3 scopes keep their original moments for offline replay.

Options must still be fresh (each canonical matched option Jaccard <0.65), and
canonical A must not be uniquely shortest. These now have separate errors. The
writer counts words up front and aims for rank 2. If only option-length checks fail,
one low-effort DSPy call receives the current question and word-count feedback,
and returns only four options. It cannot edit the stem, explanations, industry,
or frozen decision/evidence metadata; option semantics are independently reviewed.
All schema, rewrite, lineage, duplicate and independent
reviews run on the resulting question with a new content-bound ID. A second
failure rejects; interruption never triggers an automatic replay. Repair calls
are logged as `variant_length_repair` and included in generation/all-model usage.

For variants, a raw style FAIL is now a veto even when v5.1 allows an ML-practice
hinge. Original-question waiver behavior is unchanged. New variant requests freeze
`variant_mode: 1`; the runner, aggregate decision, report and ingest all enforce it.
Older frozen requests are not silently rewritten by this change.

Use repeatable `--prior-artifact` inputs for earlier runs. The offline loader binds
actual saved questions, parent snapshots, receipts, source excerpts, requests and
verdicts; it does not trust `accepted=false/true` flags or a mutable report list.
Round 2 and round 3 replay as 12 + 7 **historical-policy passes**, including the old
style-waived 84d6. This conservative history is for dedupe only, not new approval.
Their comparison rows and artifact/request/verdict hashes are frozen in the new
artifact with a snapshot digest. Later report/export/rejudge/ingest validate that
snapshot without rereading mutable prior paths. Missing/tampered evidence blocks
preflight rather than silently dropping earlier questions.

The family stem threshold stays <0.45. Earlier accepted same-parent industries
also become unavailable to allocation, with a separate
`prior_family_industry_reuse` rejection. This matters: round-2 c4c2 versus round-3
9883 has stem Jaccard **0.3088235294**, below 0.45, but both use renewable energy for
the same parent. The lexical threshold alone would not catch that scenario repeat.
Non-family vetoes stay `min(stem, key) >=0.20`. These lexical/industry checks are
not general semantic duplicate detection.

Family comparisons include only accepted or still-eligible siblings. Generation
rejects no longer consume a slot. Report and ingest first validate actual bound
quality verdicts across the cohort, so even a later style/evidence/blind/Argon
reject cannot veto a valid earlier sibling. Missing verdicts remain eligible;
newly rejected duplicate copies do not veto later siblings. Source artifacts and
verdicts are never changed by this read-only population calculation.

`round4-preflight.json` records the same six ×3 offline plan with prior history:
18 prompts, 313,041 estimated writer input tokens (character heuristic), no forced
cost slot, no prior same-parent industry reuse, 30-industry pool and at most two
uses per industry. This is not a live yield, quality or saving result.

Coordinator-only fresh live command (**not executed by the worker**):

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline && PYTHON_DOTENV_DISABLED=1 uv run python scripts/variants_ab.py run --allow-live --parent-dir /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation --artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline/.cache/variants/ab-six-r4-live.json --prior-artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline/.cache/variants/ab-six-industry-live.json --prior-artifact /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline/.cache/variants/ab-six-r3-live.json --family-stem-threshold 0.45 --review-pairs 3
```

The round-4 basename must be fresh. This writes new candidates, judges all eligible
ones with style/evidence/blind/Argon (`full_gate_sample=1`), then writes reports and
three founder-review pairs. No merge or production persistence is performed.
Human quality review and a complete cache-inclusive usage audit are still required.

Final offline gate for round 4:
`cd content-pipeline && env -i PATH="$PATH" HOME="$HOME" uv run pytest -q`
→ **2,282 passed, 3 skipped, 48 subtests passed** (25 dependency deprecation
warnings). Independent source review found no remaining concrete blocker.
No frontend files changed; frontend/Docker checks were not rerun for this round.


## Founder-approved paid-practice publication (13 variants)

Part A is the separate app PR [#289](https://github.com/smwitkowski/testero-website/pull/289).
Apply its `20261019200000_practice_question_variants.sql` migration and the taxonomy
migration before the coordinator applies the publication SQL. Do not apply the SQL
from the pipeline worktree or to production during validation.

From `content-pipeline/`, the offline dry-run prints exactly 13 full candidate IDs,
parent IDs, industries and source artifact names:

```sh
env -i PATH="$PATH" HOME="$HOME" uv run python scripts/export_approved_variants_sql.py \
  --review ../../hq/drafts/variants/subagent-review-r4-2026-10-19.md \
  --artifact .cache/variants/ab-six-industry-live.json \
  --artifact .cache/variants/ab-six-r3-live.json \
  --artifact .cache/variants/ab-six-r4-live.json \
  --dry-run
```

Replace `--dry-run` with
`--output ../../hq/drafts/variants/ingest-13.sql` to reproduce the SQL. The exporter
makes no database or model calls. It validates actual frozen independent verdicts,
then captures `persist_candidate` with an in-memory client. The stored option map,
correct flags, per-option rationales, combined explanation and document links use
that canonical persistence path. Founder approval explicitly publishes ACTIVE/GOOD
single-select rows rather than the normal DRAFT rows. It preserves `_run_id` and
records 9 generation runs for the approved subset, never the parent's run ID.

The transaction resolves current parent domains, locks original ACTIVE PMLE
single-select parents, and copies each parent's complete tag set through
`replace_question_tags(..., 'generation', ...)`. Dimension, value and confidence
are retained; copied rows receive new creation timestamps. An empty parent tag set
is faithfully copied as empty. Source references name the artifact and full ID.
Review notes record approval, artifact, request and verdict hashes.

“Idempotent” here means replay-safe, insert-only: **a repeat apply aborts before
writes**, because the brief explicitly requires aborting when any variant ID
already exists. There is no silent skip or overwrite. Missing schema, invalid
parents and existing generation runs also abort the entire transaction. The file
is generated only; the coordinator applies it after merge. No production writes
are authorized by this document.

Receipt: `practice-ingest-13.json` records the final SQL SHA256, 13 IDs, source
hashes and 9 deterministic run records. The final exporter source was independently
reviewed without a blocker. Local SQL execution validation is **blocked**: the
isolated PostgreSQL container did not finish initialization, so no fixture or
publication SQL ran. This is not a passed DB gate. The container was removed;
production is untouched. Final clean-env pipeline pytest passed: **2,299 passed,
3 skipped, 25 warnings** in 371.27 seconds, including all 17 new exporter tests.
App PR #289 passed lint, typecheck and the final Docker build. It separately records
four final test timeouts and the local DB runner setup blocker; those remain open.


## Round 5: targeted repair candidates, no live-row edits

The coordinator confirms PR289 is merged and the approved 13 variants are live.
That deployment state is coordinator context, not a new database observation by
this offline worker. This round changes only candidate generation and review on
PR286. It does not edit published questions or run production SQL.

New generation uses explicit **variant presentation policy 5**. Historical3/4
scopes, writer/repair signatures, style/evidence rubrics and bound requests remain
replayable unchanged. The normal lower-level generation function keeps its legacy
default for historical integrations; both public generation CLIs choose policy5.

- The planner varies actual key-length competition ranks (1 + count of strictly
  shorter options). Eight slots use `2,3,4,1,2,3,4,1`. Rank1 requires a shortest tie,
  not a uniquely shortest key; rank4 is uniquely longest, with the existing maximum
  two-word lead. A cheap per-item check enforces its frozen target. One bounded,
  option-only low-effort repair can fix it; schema, evidence bindings and independent
  judges then revalidate the result. There is no second repair loop or filler rule.
- The actual all-gate-pass population must have at most25% shortest/tied-shortest
  keys and at least one uniquely longest key. Report withholds accepted IDs if the
  subset fails. Direct ingest checks before DB setup, using validated pending and
  revalidated complete entries, not saved PASS flags. Generation's request-ready
  distribution is a separate diagnostic, never final acceptance.
- Cost/latency is restored as a discovery trigger, not an unrelated extra goal.
  Scale growth must explain how the issue was noticed. Style review requires
  `moment_explains_discovery` and `moment_fits_want`, including migration versus
  minimal-change conflicts, and symmetric `no_unique_want_echo` without a marked key.
- Evidence review (strict and consistent) requires `industry_realism` and
  `distractor_industry_losing_premises`. Wash count/fabric can predict linen damage;
  transit/temperature can predict produce quality. An explanation cannot dismiss
  those signals with a false premise. Ordinary vessel calls taking hours are not
  credible unless the stem really describes shift-long recordings.
- Policy5-only writer/style/Argon references replace the old longest-tie rules;
  original3/4 references remain exact. These are semantic reviewer checks, not
  a claim of deterministic industry-realism classification or measured live quality.

The new `prepare-repair` (offline) and `repair --allow-live` modes select exactly:

| Original parent | Slot | Replacement target | New candidates |
| --- | --- | --- | ---: |
|9a174e39|migration|95c6|2|
|a31d11b8|scale growth|c2bd|2|
|57b9d0c7|migration|6fc9 /84d6|2|
|9a174e39|cost/latency reduction|a612|2|

The required `--live-prior-manifest` binds the committed publication receipt to
its approval, SQL, all three source artifact hashes and the exact13 IDs, parents,
industries and artifacts. The loader replays34 full historical passes offline,
then exposes exactly the approved13 as dedupe priors. Its nested original snapshot
is retained unchanged. Replay cannot strip or replace this live-family snapshot.
This is comparison-only history, not independent database LIVE verification or
new serving approval. Industry allocation and family/non-family dedupe use those
13 rows; the family stem threshold remains strictly below0.45. Targeted candidates
are fresh variants, not edits to the old failed or live entries.

Coordinator-only live repair command (**NOT executed by this worker**):

```sh
cd /Users/switkowski/Projects/Testero/frontend.prime-testero-variants-1019/content-pipeline && \
PYTHON_DOTENV_DISABLED=1 uv run python scripts/variants_ab.py repair --allow-live \
  --parent-dir /Users/switkowski/Projects/Testero/frontend.prime-testero-pipeline/content-pipeline/.cache/generation \
  --artifact .cache/variants/repair-r5-live.json \
  --live-prior-manifest calibration/variants-2026-10-19/practice-ingest-13.json \
  --prior-artifact .cache/variants/ab-six-industry-live.json \
  --prior-artifact .cache/variants/ab-six-r3-live.json \
  --prior-artifact .cache/variants/ab-six-r4-live.json \
  --family-stem-threshold 0.45 --review-pairs 8
```

Use a fresh basename; interrupted attempts are not automatically replayed. To
render the same8 prompts without model calls, replace `repair --allow-live` with
`prepare-repair` and use a fresh offline artifact. Live mode runs independent
style/evidence/blind/Argon review for every eligible candidate (`full_gate_sample=1`),
then reports decisions/usage and up to8 complete review pairs so both alternatives
per slot can be inspected. Gate passes are not publication. Human selection,
measured live yield/realism and production authorization remain coordinator work.

Offline receipt: `round5-repair-preflight.json` records **8 prompts**, planned ranks
`2,3,4,1,2,3,4,1`, **13 selected live priors** (34 full historical records retained),
maximum1 use per assigned industry, and **158,470 estimated writer input tokens**.
The estimate is characters/4, not provider usage. No candidates or model calls
were produced by preflight. Combined focused validation passed316 tests; the
required full-suite result is recorded below once it completes. Independent
source review found no remaining blocker after the replay/population fixes.

Final required round5 gate: `cd content-pipeline && env -i PATH="$PATH" HOME="$HOME" uv run pytest -q`
→ **2517 passed, 3 skipped, 25 warnings, 48 subtests passed in 92.56s (0:01:32)**. Exact tested Python source hashes match the final tree;
all106 protected historical inputs/approved SQL/receipt files are unchanged.
No live model calls, production writes or merges were made.
