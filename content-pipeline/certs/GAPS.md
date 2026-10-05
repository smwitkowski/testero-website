# Implementation gaps and smallest Phase 2 plan

Read-only source audit at the Phase 1 branch baseline; retrieved 2026-10-04.
The lines below refer to unchanged source. Nothing in this file is implemented.
No external API or DB was called for this audit. Source modules were read as text,
not imported: several load dotenv or SDK configuration at import time.

## Confirmed source facts

| Area | Evidence | Gap / reuse decision |
| --- | --- | --- |
| Scope | `shared/domain_context.py:12-448` contains only PMLE; `:451-468` rejects unknown codes. `:536-538` silently ignores bad subsection context. | Replace prompt-context lookup with a registry adapter in Phase 2; reject invalid objective IDs, do not silently broaden scope. |
| Corpus | `shared/doc_search.py:79-84,98-103` searches `docs.cloud.google.com`; `:133-137` retrieves with Firecrawl. `shared/exa_client.py:45-50` and `shared/firecrawl_client.py:51-56` require their existing API keys. | Existing discovery/retrieval seam is reusable; Phase 1 refresh does not use these services. Technical corpus tooling should use approved official pages and immutable local snapshots, not a new service. |
| Wrong-source risk | `shared/doc_search.py:157-168` first joins by normalized URL, then assigns missing URLs by list index. URL normalization lowercases the whole URL and removes all query strings (`:147-155`). | Never assume a scrape batch preserves request order. Match requested/final URL records explicitly; reject unresolved redirects/duplicates. Preserve path/query case and material query parameters. |
| Unfetched references | `shared/doc_search.py:188-219` can return refs without meaningful body content; `:221-261` guesses `https://docs.cloud.google.com/{service-slug}` when discovery/import fails; `:263-266` returns empty context on other failures. | URLs alone are not grounding. Remove guessed-link success paths and require nonempty fetched evidence per objective/rationale. |
| Subsection retrieval | `shared/pmle_program.py:208-212` passes domain name/services, not subsection considerations, though `shared/doc_search.py:22-27` accepts them. | Pass objective-specific search terms; do not treat domain-wide retrieved text as proof of each candidate fact. |
| Output contract | `shared/llm_generator.py:79-134` produces one correct answer and three distractors with rationales; `:91,118,132` prohibits inline references. `shared/validator.py:354-365` rejects citations/URLs in explanation text. | Keep learner prose separate from evidence metadata. Add a structured DSPy evidence output, not hand-prompted JSON or inline citations that the existing cleanup removes. |
| Mechanical grounding | `shared/validator.py:154-403` checks fields, text, service mentions and explanation heuristics. `shared/quality_gate.py:144-181` requires nonempty context but takes no source records/quotes. | Neither checks that every quotation is verbatim on its claimed fetched page. Neither binds a quote to each correct/distractor rationale. Add a small pure mechanical evidence validator. |
| Judge | `shared/quality_gate.py:43-70,199-220` already checks whole-question accuracy, uniqueness, plausibility, rationales, scope, clarity and evidence; requires PASS >=0.8 and all checks. DSPy uses per-call LM (`:187-193`). | Reuse this fail-closed gate, extend its evidence input. Quote presence proves provenance, not truth or entailment; the semantic judge remains necessary. |
| Model independence | CLI default is `openrouter/google/gemini-2.5-flash` (`scripts/generate_pmle_questions.py:190-192`) and the same `model` is sent to `judge_question` (`:557-560`). Legacy option evaluator also gets `self.model` (`shared/pmle_program.py:710`). | Different function calls are not different model families. Add an explicit independent judge-model setting plus a strict known-family check; no changes made now. |
| Legacy scoring | `shared/pmle_program.py:749-750` accepts any non-FAIL option verdict; `shared/pmle_metric.py:59-73` does not fail for missing factual eval or UNCERTAIN. | This optimization/research score is not the publication gate. Preserve the mandatory fail-closed question judge; do not substitute legacy metrics. |
| Allocation/coverage | `scripts/generate_all_domains.py:216-255` gives each subsection/difficulty the same count. `shared/batch_eval.py:121-147` never assigns domain codes or increments domain counts, so nonempty valid batches report zero domain coverage. | Record cert/domain/objective metadata and calculate actual counts versus reviewed weighted quotas. Current batch coverage is not evidence of alignment. |
| Persistence | `scripts/generate_pmle_questions.py:534-560` judges cleaned content; `:599-609` creates DRAFT; `:662-678` stores flat doc links; `:684-685` finalizes review after child writes. | Preserve cleaned-content judging and DRAFT sequencing. Flat links lack quote/source-hash/rationale associations. Use an immutable local evidence artifact and its reference before proposing DB schema work. |
| Founder gate | `scripts/review_batch.py:54-96` requires completed run, DRAFT+GOOD, judge pass, four nonempty rationales and exactly one key; `:121-135` displays random ceil(10%) sample. `:161-199` verifies manifest and guards approval. | Reuse this gate; add immutable source/evidence metadata to report/fingerprint. It is human attestation, not proof that a person read the sample. |
| DB capacity | `supabase/migrations/20261003000000_v2_baseline.sql:4-32`: globally unique domain code, free-text exam, answer `is_correct` booleans and flat `doc_links`. | New cert text/domain codes are structurally possible, not seeded or product-ready. DB booleans do not enforce exactly one correct option. No DB writes were made. |
| Live limits | `lib/diagnostic/pmle-selection.ts:19-34` enforces one key; `:168,242` hardcodes PMLE. `lib/practice/service.ts:45-52` requires PMLE blueprint domain and PMLE exam. Baseline session items `:66-71` use singular correct/selected labels. | Keep the app PMLE-only. Multiple-select needs separate approved schema/scoring/product work; do not insert it and assume the app can serve it. |

Paths in the table's Python rows are relative to `content-pipeline/`.
`supabase/migrations_legacy/20251119162319_create_pmle_canonical_schema.sql:74,77`
comments describe exactly-one-correct intent, not an SQL cardinality constraint.
Legacy migrations are historical evidence, not runnable migration instructions.

## Evidence contract and failure tests

Proposed artifact, outside learner-facing rationale text:

- Candidate: cert ID, guide hash, section/objective locator, persistent objective
  identity/alias if reviewed, exact cleaned-content hash, answer mode and keys.
- Source: requested URL, final URL, observed canonical URL if present, timestamp,
  HTTP status/content type, frozen extracted-text hash and extractor version.
- Evidence per option rationale: option label, factual claim, source ID, short
  exact quote, and offsets into that exact extracted text. Cover every material
  technical claim; one generic quote does not ground a whole complex rationale.
- Correct options need support for capabilities and scenario fit. Distractors need
  support for the technical premise and the specific constraint they fail.
  Absence of a capability in a page is not evidence that the capability cannot
  exist. Missing proof means UNCERTAIN, not a fabricated negative claim.

Decode/extract once, freeze the visible technical-page text, then require exact
case-sensitive substring/offset equality. Do not use fuzzy matching, lowercasing,
paraphrase similarity, or an LLM to declare a quotation verbatim. If normalization
is needed for HTML/PDF whitespace, version that extraction transform and validate
against its frozen output, not a different representation. Bind source and
candidate hashes so edits invalidate evidence/judge approval. Short quotes need
source attribution; license exceptions and source-specific terms still apply.

Offline tests should reject: swapped/out-of-order scrape results; guessed URLs;
empty/failing retrieval; off-allowlist redirect; quote on wrong source; quote not
present; Unicode/case/offset mismatch; missing distractor proof; changed hash;
unknown/same model family; UNCERTAIN; multi-select passed to single-key adapter;
and stale approval after candidate/evidence edits. Include positive tests with
original synthetic technical text, not copied official sample questions.

## Independent-model rule

Propose `--judge-model` independently from existing `--model`. Resolve explicit
model IDs using a small reviewed provider/model-family map (strip transport prefix
such as `openrouter/`, not the actual family). Examples: Gemini/Gemma are not
interchangeable labels for a proven independent provider; initially choose a
conservative provider-and-family separation, such as Gemini generation with a
known Claude or GPT judge. Different Gemini sizes/versions do not satisfy the
rule. Unknown aliases/families fail closed. Record both full model IDs and family
IDs on the run/evidence artifact; require independence again before approval.
Use DSPy typed signatures and per-call `lm=` as the current gate already does.
This is a design rule only; no model was called and no IDs were tested live.

## Canonical URLs and rights: measured, not assumed

Fetched official technical example:

- `https://cloud.google.com/storage/docs/introduction` redirected to
  `https://docs.cloud.google.com/storage/docs/introduction`.
- The latter returned the same URL in its `rel=canonical` tag. Its footer, retrieved
  2026-10-04, says page content is CC BY 4.0 and code samples Apache 2.0, except as
  otherwise noted; displayed update date was 2026-10-01 UTC.
- This is one observed redirect, not proof that every legacy URL can be rewritten
  mechanically. Store requested/final/canonical URLs and a reviewed alias table.
  Revalidate redirects and final hosts during corpus refresh.

Official certification terms:
`https://cloud.google.com/certification/terms`, section 3, restrict disclosure,
copying and transmission of Exam content. The technical-doc footer license must
not be applied to exam/sample materials. Public sample reuse rights are not
established by this audit (`null` / pending); commit only aggregate style metadata,
source URLs and original content. Never commit sample stems/options/keys. Raw
official HTTP is local gitignored cache only. Do not follow non-Google license
links during this official-Google-only research; the observed Google footer is the
basis for the license statement, not legal advice or blanket permission.

## Small Phase 2 patch list (estimate, separate authorization required)

No new framework, background service, storage vendor or large pipeline rewrite.
Estimates are changed/new LOC excluding generated data; they are not commitments.

| Task | Minimal files / seam | Rough LOC / size |
| --- | --- | --- |
| Registry adapter, code mapping and weighted planner | New `shared/cert_context.py` + planner helper; small edits `domain_context.py`, `generate_all_domains.py`, `batch_eval.py`; pure tests. | 180-280 + 100-160 tests; 1-2 days |
| Corpus provenance and exact quote gate | New `shared/evidence.py`; edit `doc_search.py` URL joins/fallbacks; extend DSPy signature/program outputs and cleanup-preserving artifact export; pure tests. | 250-400 + 140-220 tests; 2-3 days |
| Different-family judge configuration | Edit generation CLI and `quality_gate.py`; run/model metadata in local artifact; family-map tests. | 50-90 + 50-90 tests; half-day |
| Founder evidence report and impact diff | Edit `review_batch.py` report/fingerprint; new small `scripts/flag_cert_changes.py` offline artifact join (no writes); tests. | 120-200 + 80-140 tests; 1 day |

First checkpoint: PMLE four-option single-answer adapter end to end with synthetic
fixtures, deterministic allocation and mechanical proof, followed by separately
authorized live generation/founder approval. New certs may be generated only in
supported single-answer mode after mapping approval; unsupported formats remain
blocked. New DB code seeds require separate explicit approval. Multiple-select
app/schema/scoring work, new-cert app support and a legacy processor are **not**
part of this patch list. No phase automatically grants permission for another.
