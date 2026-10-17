# Multi-cert foundation (D-038)

## Scope and current contract

Phase 1 stores new-cert DRAFT questions. Phase 2 makes ACE batches repeatable.
Phase 3 is a plan only. PMLE routes, query filters, weights, scoring, answer order,
quota, paid explanations and the PMLE Pass do not change. No non-PMLE diagnostic
or practice CTA is enabled. No live generation or production migration was run.

## Data model: exam keys, not another catalog

Use the existing `questions.exam` key, also on `exam_domains`. The reviewed
`content-pipeline/certs/registry.json` remains the certification catalog; do not
create a second exams table to synchronize. These are internal keys, not official
Google exam codes:

| Cert registry ID | Database exam key | Domain code |
| --- | --- | --- |
| machine-learning-engineer | GCP_PM_ML_ENG | Existing six PMLE codes, unchanged |
| cloud-engineer (ACE) | cloud-engineer | cloud-engineer:standard:<section> |
| cloud-architect (PCA) | cloud-architect | cloud-architect:standard:<section> |
| data-engineer (PDE) | data-engineer | data-engineer:standard:<section> |

`exam_domains.exam` is non-null and defaults to `GCP_PM_ML_ENG`. This backfills
all historical domains without renaming them or changing their IDs. Uniqueness
is `(exam, code)`, so the same code can exist under different exams. New codes
retain the planner's cert prefix to preserve frozen artifacts. Domain resolution
must use both exam and code. A composite `(questions.domain_id, questions.exam)`
foreign key references `(exam_domains.id, exam_domains.exam)`. Replace the old
single-column FK rather than adding a second PostgREST relationship: existing
`exam_domains!inner(code,name)` nesting stays unambiguous. No question exam is
rewritten. Inconsistent historical exam/domain assignments deliberately stop the
migration; reconcile them before retry, never silently reassign content.

The migration seeds 4 ACE, 6 PCA and 5 PDE standard-guide domains with titles and
hash provenance from their reviewed JSON guides. PMLE names and content remain
unchanged. Existing table RLS and service-role-only grants are inherited; no new
browser grant or policy is added. No app database type file exists to regenerate.

### Answer mode and future scoring

`questions.question_type` is `single_select` (default) or `multiple_select`.
Existing rows become `single_select`. `answers.is_correct` already supports
multiple true rows, so no duplicate answer-key column is needed. Multiple-select
rows cannot be ACTIVE before Phase 3. Phase 1 ingestion accepts only four-option
single-select; it rejects explicit multiple-select/array-key inputs before any
DB client or write. It must never truncate a set of correct answers to one.

Phase 3 validation will require unique option labels, one correct option for
single-select, and at least two correct options plus at least one distractor for
multiple-select. At publication, enforce this across the answer rows and mode
in one transaction (or a deferred constraint trigger), not a row-local CHECK.
No new cross-table cardinality trigger is imposed on historical PMLE rows now.
Multiple-select scoring is **exact set equality**, order-independent, no partial
credit: selected `{A,C}` equals correct `{C,A}`; `{A}`, `{A,B,C}` and repeated
labels are rejected or wrong, never partial marks. Store one boolean per item
and count items, not options, for aggregate/domain scores. Label the select count
clearly; no answer/explanation leak before the existing access boundary.

## Ingest

`ingest_external_verdicts.py` binds the artifact cert to its exam key (PMLE alias
excepted; legacy `machine-learning-engineer` artifacts store as `GCP_PM_ML_ENG`
without rewriting their frozen identity) and every scope to the current registry,
resolves `(exam, domain_code)`
for every planned domain before creating runs, then reuses the existing DRAFT,
review, evidence, independent-judge and durable journal flow. Generation runs
carry the matching exam. `get_domain_by_code` defaults to PMLE for legacy callers;
the registry generator and external ingest pass the explicit exam. Existing
single-select persistence and PMLE query effects are unchanged. The DB default
supplies `question_type=single_select`; answer/rationale ordering is unchanged.
Multiple-select needs a new writer/judge schema and immutable request hashing;
just adding an extra key to today's four-option adapter is not sufficient.

Non-PMLE content remains DRAFT even after all generation gates. Do not run the
PMLE autonomous publication/retirement loop for ACE. Founder review, sufficient
coverage and the Phase 3 application launch are separate approvals.

## Phase 2 batch readiness

The generator loads cert-aware objective/domain prompts from the reviewed guide.
ACE receives full product-specific style gates: the PMLE-only ML-practice list
must default off for ACE/PCA/PDE. Retrieval, verbatim receipts, distinct-vendor
judges, Argon, duplicate checks, accepted-key balance and token telemetry retain
their existing contracts. Export only ACTIVE+DRAFT questions for the selected
exam, including all pages, for near-duplicate comparison. An empty ACE bank is
valid; a failed export is not an empty bank. Use separate cert-prefixed artifact,
export, verdict and telemetry paths. Batch runner details and exact coordinator
commands are documented in the Phase 2 runbook.

## Phase 3: later, do not implement yet

1. Add a server-owned exam configuration keyed by approved registry IDs. Keep
   PMLE's legacy weights/domain mapping as a golden fixture; normalize each new
   cert's own guide weights. Cert release is an explicit allowlist, not inferred
   from any row existing in the DB. Require reviewed ACTIVE+GOOD domain stock
   before enabling a cert.
2. Parameterize diagnostic selection and practice by validated exam. Filter both
   questions and domain by exam and supported question type. Keep PMLE behavior
   and existing URLs as defaults. Carry the exam through session creation,
   dashboard/history, results, analytics, dedupe/seen-question preferences and
   API validation. Add a cert selector only at launch.
3. Version the session snapshot and RPC input. New snapshots include question
   type, correct-label array and selected-label array. Backfill old scalar
   snapshots to one-element arrays without changing their results. Preserve old
   sessions via an explicit versioned API rather than silently changing the
   current scalar RPC. Server-side set validation/scoring must run inside the
   existing answer transaction (owner, expiry, ordinal and retry checks). Same
   set in another order is idempotent; a changed set is a conflicting retry.
4. Use radio controls for single-select and checkboxes for multiple-select, with
   accessible select-count instructions, change-until-Next behavior, resume and
   review. Shuffling remaps **all** correct labels, selected labels and rationale
   references together. Aggregate-only anonymous results and fresh fail-closed
   paid explanation access remain unchanged unless separately approved.
5. Decide non-PMLE entitlement/pricing before enabling paid practice. A PMLE Pass
   must not silently grant other certs; billing remains untouched in Phases 1–2.
   Decide whether the five-question free quota is cross-cert or per-cert, then
   enforce that rule atomically at session creation, not just in UI.
6. Extend generator, external requests, exact evidence receipts, blind solver,
   Argon matching, ingest and review to multiple-select together. Add cardinality
   and mode validation before removing the DB's no-ACTIVE-multiple-select guard.
   Require independent founder-reviewed examples before enabling the mode.

Verification: cross-cert leakage/invalid IDs; blueprint stock/weights; single-
versus multiple-select validation; exact-set and reordered retries; shuffled key
sets; snapshot resume/history; owner/expiry/ordinal rules; anonymous leaks; paid
access revocation; concurrent quota; local free/paid/refunded flows. PMLE golden
queries/results and all existing tests must stay green. Do not claim fixtures
validate live Stripe, cloud delivery, or question quality.

## Rollout and rollback

1. Review/merge Phase 1 only with local migration/SQL, pipeline and app gates.
   Coordinator applies `20261017190000_multi_cert_foundation.sql` to production
   after merge. Migration assumes existing domain codes are globally unique (the
   baseline constraint) and every current question's exam is PMLE; it fails on
   mismatched content instead of guessing. Check inventory before applying.
2. Review/merge Phase 2. Coordinator runs small ACE single-select batches, checks
   telemetry and gates, and leaves results DRAFT. No live model calls in either
   implementation PR. Grow ACE first, then PCA, then PDE under approved budgets.
3. Separately approve and implement Phase 3, select/practice APIs and entitlements
   before publishing non-PMLE banks or serving multiple-select.

Rollback app code independently; existing PMLE defaults remain compatible. Keep
new rows DRAFT and retain the additive columns/FK. Do not drop scoped uniqueness
or columns after importing new-cert content. A destructive down migration needs
an explicit inventory/export and coordinator approval; no automatic deletion.
