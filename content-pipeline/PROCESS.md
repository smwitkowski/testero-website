# Docs-grounded question process

Phase 1 design and source audit, retrieved **2026-10-04**. No generation, judging,
DB writes, publication, or app changes are authorized by this work. Registry
refresh is a separate offline-capable tool; it does not make this process live.

## Repeatable checklist

Status applies to the reusable capability and the listed gap, respectively.
`EXISTS / NEEDS CHANGE` means reuse the current piece but close its stated gap.

| Step | Status | Existing capability | Required change / exit condition |
| --- | --- | --- | --- |
| 1. Refresh the cert registry | EXISTS (Phase 1) | New `scripts/refresh_cert_registry.py`; official Google sources and local cache. | Review inventory/guide/sample-link diffs. Keep cert identity, exam version, and renewal/main variants separate. Missing weights/objectives remain `null` with a reason; never infer them from another exam. |
| 2. Map domains to canonical codes | EXISTS / NEEDS CHANGE | `questions.exam` is text; `exam_domains.code` is globally unique. PMLE has six fixed codes. | Preserve PMLE codes. Propose cert-prefixed codes for new certs; approve any later DB seed separately. Track registry locators separately from guide hashes; review persistent objective identities/aliases across revisions (ordinal IDs alone are not stable). |
| 3. Build an objective corpus | EXISTS / NEEDS CHANGE | `doc_search.py` discovers docs with Exa and retrieves with Firecrawl. | Cache fetched official technical pages by requested URL, final URL, retrieval time and content hash. Associate each objective with reviewed pages. No guessed service-slug URLs or positional URL/content joins. An unfetched URL is not evidence. |
| 4. Allocate and generate | EXISTS / NEEDS CHANGE | DSPy PMLE signatures, subsection targeting, correction and duplicate checks exist. | Load registry scope and `certs/STYLE.md`; allocate domain quotas by official weights using largest remainders, then cover objectives within each domain. Record the objective ID and guide hash on every item. Unknown weights require a reviewed allocation, not invented percentages. Existing all-domain generation is equal-count, not weighted. |
| 5. Check schema and evidence mechanically | EXISTS / NEEDS CHANGE | Validator checks PMLE structure and rationale text; it does not verify quotations. | Require original stem/options, answer mode, valid key cardinality, all option rationales, and a doc URL + short verbatim quote for **each correct and distractor rationale**. Match every quote exactly against the fetched page's frozen extracted text and hash. Reject invented, empty, mismatched or unfetched evidence before judging. See `certs/GAPS.md`. |
| 6. Judge independently | EXISTS / NEEDS CHANGE | Fail-closed DSPy question judge: PASS, score >= 0.8, all rubric checks true. | Add a separate judge-model setting and fail closed unless its known model family differs from the generator's. Judge the exact cleaned candidate plus mechanically verified evidence. Check answer-mode/key-cardinality correctness, plausible distractors, accurate rationales, scope and clarity; the current adapter permits one key only. UNCERTAIN, exception or malformed verdict cannot publish. |
| 7. Founder spot-check | EXISTS / NEEDS CHANGE | `review_batch.py` exports a uniform random ceil(10%) sample of completed-run DRAFT+GOOD candidates. | Review every sampled stem, option, key, rationale, source quote and judge verdict. Include evidence/version metadata in the export. Any defect blocks approval; fix/rejudge and export again. Use at least one item for a nonempty pool (already true). |
| 8. Approve explicitly | EXISTS | Existing approval verifies the exported candidate fingerprint and guarded updates before ACTIVE. | Preserve DRAFT until founder acceptance. Do not use a registry refresh or an LLM verdict as approval. Approval must remain a separate human-attested operation. |
| 9. Recheck freshness | EXISTS / NEEDS CHANGE | Registry refresh/diff exists in Phase 1; per-question impact tracking does not. | On guide, objective, weight, service-document or answer-capability changes, flag affected question IDs via objective IDs/document hashes; queue re-grounding and rejudging. Review removals and aliases manually. Do not silently rewrite/retire ACTIVE questions or apply DB changes during refresh. |

## Minimal handoff contracts (Phase 2 proposal, not implemented)

- **Registry -> planner:** cert ID; main/renewal variant; guide source/hash and
  retrieval date; ordered domains, weights, sections and objectives; registry locators and reviewed identity aliases;
  proposed canonical exam/domain mapping. Do not assume an official version label
  exists: `null` plus the observed guide hash is valid.
- **Corpus -> generator:** objective ID + immutable document records
  (`requested_url`, `final_url`, `retrieved_at`, `text_sha256`, extracted text).
  Retrieval failures stay failures, not empty-content successes.
- **Candidate -> mechanical gate:** exact cleaned stem/options/keys/rationales,
  answer mode, objective ID, guide hash, and evidence records per rationale.
- **Mechanical gate -> judge -> founder:** immutable candidate/evidence hash,
  explicit generator/judge model IDs and family IDs, detailed checks/verdict,
  sample manifest and approval. Persist an artifact reference in existing
  `source_ref`/run notes first; do not add a new service or framework.
- **Freshness -> review:** old/new guide/doc hash, semantic changes, affected
  objective IDs and candidate/question IDs. Formatting-only changes are distinct
  from weight/objective changes; unknown impact must be reviewed, not ignored.

## Compatibility boundaries

Registry coverage is not product support. The live diagnostic and practice app
remain **PMLE-only**. No new-cert routing, billing or session work is in scope.
The DB can store new exam text and domain codes, but current generator, validator,
judge, founder review and session scoring assume one correct answer; the generator
and review require four options. Multiple-select official formats are therefore
**blocked**, not normalized into a fake single-answer exam. DB answer booleans do
not themselves enforce one key; the live session schema does store singular labels.

Historical canonical-schema comments are not proof of current format support.
Read-only evidence, exact implementation gaps, rough Phase 2 task sizes and the
PMLE comparison are in `certs/GAPS.md` and `certs/PMLE-DRIFT.md`.

## Source and rights rules

Use only official Google certification pages, linked official exam guides/sample
Forms, Google Cloud technical docs and Skills Boost. Certification guides define
scope; samples inform aggregate style, never the answer facts. Write original
questions. Do not commit official sample stems, options, answer keys or raw Forms.
Raw HTTP belongs only in `.cache/cert-registry/` (gitignored). Do not assume a
technical-doc license grants rights to exam materials. See `certs/GAPS.md` for observed official footer/terms and canonical redirect evidence.
Review each source; pending facts stay `null`.

## Safe commands

Run from `content-pipeline/` using the native environment. Use the registry tool's
`--help` for refresh/diff options. Only registry-parser/diff tests are relevant to
this Phase 1 change; tests run offline with dotenv/network disabled by conftest.
Do not run existing generation/review/DB CLIs, including their `--dry-run` modes,
for this research task. Do not open `.env*`, backups or credentials.
