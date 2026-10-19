# Verified-parent variants: offline handoff (2026-10-19)

## Scope and quality bar

Opt-in only. Default `generate_variants.py` renders prompts without any model,
retrieval or DB call; `--enable-variants` authorizes one writer call per attempt.
It skips plan, verify and cite calls. No retries or automatic repair. Unknown or
interrupted attempts remain consumed; use a fresh artifact basename.

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
