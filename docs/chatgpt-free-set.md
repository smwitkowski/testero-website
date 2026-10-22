# ChatGPT fixed free question sets (D-042 / multi-exam)

`lib/chatgpt/free-set.json` preserves the original PMLE 40-question ID allowlist
and its selection provenance. `lib/chatgpt/free-sets.json` is the multi-exam map,
keyed by **database exam ID** for additional exams. Use the actual database value:
PMLE is `GCP_PM_ML_ENG`; some other exam IDs, such as `data-engineer`, match their
page slugs. Each additional entry is an IDs-only manifest with `version`, `source`
and `question_ids`. PMLE loads directly from the original file; do not duplicate
PMLE in the map, replace its IDs, or reselect that set to add an exam.

Every manifest requires `version: 1`, a strict `source` object and a nonempty
`question_ids` array of unique lowercase UUID strings. PMLE retains exactly 40 IDs.
`source` is **required**, not an arbitrary metadata object. Only these keys are
accepted; arbitrary or nested keys are rejected:

| Source key | Required value or constraint |
| --- | --- |
| `kind` | Literal `local-export` |
| `upstream` | Literal `read-only-database-content-export` |
| `exported_at` | Valid ISO 8601 UTC timestamp in exact `YYYY-MM-DDTHH:mm:ss.sssZ` form, for example `2026-10-22T00:00:00.000Z`; impossible dates are rejected |
| `export_sha256` | Exactly 64 lowercase hexadecimal characters |
| `blueprint_sha256` | Exactly 64 lowercase hexadecimal characters; optional for additional exams, retained for PMLE |
| `selection` | Lowercase hyphen-separated machine token, at most 100 characters; no prose or arbitrary text |

This additional-exam map entry shows the valid shape with **synthetic example
values only**. The UUID and all-zero hash do not identify a real question or prove
an export. Replace them with reviewed IDs and actual provenance before enabling
an exam; do not copy this example into the release map.

```json
{
  "data-engineer": {
    "version": 1,
    "source": {
      "kind": "local-export",
      "upstream": "read-only-database-content-export",
      "exported_at": "2026-10-22T00:00:00.000Z",
      "export_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "selection": "synthetic-example-v1"
    },
    "question_ids": ["00000000-0000-4000-8000-000000000001"]
  }
}
```

A new exam must carry reviewed nonsecret provenance appropriate to its selection.
A syntactically valid hash or timestamp does not establish source authenticity.
No manifest may contain stems, options, correct flags, explanations, domain
assignments or per-question eligibility flags. Do not check in full-bank or
selected-content exports. The ignored local source is content, not a credential
or secret. Never read or copy it for new synthetic tests.

## Runtime loading and enablement

`CHATGPT_EXAMS` is a server-only comma-separated allowlist of database exam IDs.
When unset, the default is `GCP_PM_ML_ENG`; an explicitly empty value is invalid and fails closed. Only exams with valid fixed-set manifests and
existing certification-registry/taxonomy data can be enabled. Invalid configuration
fails closed; it must not silently expand access or fall back to another exam.
D-043 website beta diagnostics and `BETA_DIAGNOSTIC_CERTS` are a separate surface;
they do not grant ChatGPT access.

The first three tools (`exam_overview`, `list_practice_domains`,
`get_practice_question`) accept an optional `exam` enum derived from the enabled
allowlist. Omission selects PMLE, not whichever exam appears first; it returns a
clear validation error if PMLE is disabled. Unknown or disabled exams get a clear
validation error listing available exams. `check_answer` accepts only
`question_id` and `selected_label`; it resolves the owning enabled set server-side.

`lib/chatgpt/questions.ts` is server-only and reads through the server Supabase
client only for IDs in the requested exam's manifest. Query and returned-row
validation enforce that exam, `ACTIVE`, `GOOD`, explicit original parent and
`single_select` eligibility. A cross-exam row cannot pass because its ID appears
in another manifest. Disabled-set and outside-set IDs cannot expose an answer.

It validates A–D options, a boolean single correct flag, full explanations and the
literal policy filter below. It fails closed for missing or ineligible content,
never substitutes another bank question, and discards expired cached content
before refreshing. Validated content is cached per instance for up to 30 seconds.
Eligibility changes can therefore take up to 30 seconds to appear. A public
manifest is not proof of current database eligibility.

Question-serving tools omit every `is_correct` and `explanation`;
answer-checking tools may reveal those fields only for the submitted eligible
question. See `docs/chatgpt-mcp-verification.md` for evidence scope and required gates.

## Add an exam: data and allowlist only

1. Confirm the exam already has certification facts and domain taxonomy in the
   site's existing registry. Use its actual database exam ID, not an assumed
   naming convention or page slug. Do not
   duplicate facts, fees or domains in MCP code. An exam missing registry/taxonomy
   data is not ready for this data-only path.
2. Obtain an authorized IDs-only selection with explicit exam/original/eligibility
   provenance. Review a fixed set of eligible original single-select questions
   with complete A–D explanations and the same literal no-commerce policy.
   Never publish the source corpus. The PMLE selector below is PMLE-specific;
   do not run it against another exam or claim its 40-question quotas are universal.
3. Add a `version` / `source` / `question_ids` manifest under that database exam ID
   in `lib/chatgpt/free-sets.json`. Supply all required strict `source` fields
   above; `blueprint_sha256` alone is optional for an additional exam. Do not add
   arbitrary/nested metadata or omit provenance. Keep PMLE's original artifact unchanged;
   do not add PMLE to this additional-exam map. IDs must be unique and must not overlap another exam's set.
4. Add that database exam ID to server-side `CHATGPT_EXAMS` through the normal
   deployment process. Do not add secrets, edit a production environment here,
   or infer ChatGPT enablement from website beta flags. No tool implementation
   change is needed for an exam supported by the existing registry/taxonomy.
5. Run synthetic multi-exam tests and local official-SDK smoke checks, then the
   required release gates. Verify enum membership, PMLE default/disabled behavior,
   invalid configuration, unknown exam errors, cross-exam row rejection, disabled
   IDs, no key leakage and no-commerce outputs. Record results separately from
   provenance review. Do not claim deployed availability until verified.

Only PMLE's existing informational links are policy-reviewed for this release.
Enabling another exam does not allow its website URLs in tool responses. Do not
add an unreviewed cert-page, purchase, registration or waitlist handoff.

## Original PMLE selection rule

The offline selector reads `lib/constants/pmle-blueprint.ts`, not a second weight
list. The official approximate percentages total 101, so the normalized weights
are 13/101, 16/101, 21/101, 20/101, 18/101, and 13/101.

Hamilton rounding first assigns `floor(40 * numerator / 101)` seats. It assigns
the remaining seats by descending integer remainder, breaking ties in blueprint
order. Floors are 5, 6, 8, 7, 7, 5; remainders are 15, 34, 32, 93, 13, 15.
The two extra seats go to serving and collaboration. The final allocation is:

| Domain code | Weight | Questions |
| --- | --- | ---: |
| ARCHITECTING_LOW_CODE_ML_SOLUTIONS | 13/101 | 5 |
| COLLABORATING_TO_MANAGE_DATA_AND_MODELS | 16/101 | 7 |
| SCALING_PROTOTYPES_INTO_ML_MODELS | 21/101 | 8 |
| SERVING_AND_SCALING_MODELS | 20/101 | 8 |
| AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES | 18/101 | 7 |
| MONITORING_ML_SOLUTIONS | 13/101 | 5 |

Within each domain, choose the lexicographically lowest lowercase UUIDs among
eligible questions. Output IDs grouped in blueprint domain order, with UUIDs
sorted within each group. Domain assignments and options are never written.
Never redistribute a shortage: fail rather than silently changing the allocation.

PMLE selection eligibility requires all of:

- `exam === "GCP_PM_ML_ENG"`, `status === "ACTIVE"`, `review_status === "GOOD"`.
- Explicit `parent_question_id === null`; variants are never eligible. Runtime
  additionally enforces `single_select` type for every enabled exam.
- A known domain and nonempty original stem.
- Exactly four distinct options labeled A, B, C, D.
- Boolean correct flags with exactly one `true`.
- Nonempty text and full explanation on every option.
- No literal policy terms in the stem, option text, or per-option explanations:
  price/prices/pricing, checkout, upsell, upgrade, buy, purchase, USD, numeric dollar
  amounts, or `/pass` and `/passes` links. This deliberately excludes even benign
  cloud-cost references that would violate the literal tool-output rule. The
  selector skips those originals; it never rewrites the source content.

The selector rejects exports with missing `parent_question_id` on **any** question.
An old `.qa/bank.json` mirror does not include that field and cannot prove original
provenance. Never add null values to an old export to make it pass. A separate
question-level explanation does not substitute for per-option explanations.

## Original PMLE source and provenance

The selected source was a locally saved, content-only **read-only production
export**, not the 30-question local seed. The seed had only five originals per
domain and could not meet the quotas. The coordinator exported 165 ACTIVE GOOD
PMLE originals with an explicit `parent_question_id=is.null` filter, their 660
answers, question-level explanations, and six domains. It did not export user or
billing data or write to production. The offline selector itself has no database,
network, credential, or environment-file access.

The ignored local input is `.qa/chatgpt-source.json`. Its shape is:

```text
{version: 1, source: <nonsecret source identifier>, exportedAt: <ISO timestamp>,
 questions: [{id, exam, domain_id, stem, status, review_status, parent_question_id}],
 answers: [{question_id, choice_label, choice_text, is_correct, explanation_text}],
 exam_domains: [{id, code}], explanations: [...]}
```

`explanations` is optional and unused by selection. Additional source fields are
not copied into the snapshot. Do not include credentials or user data in exports.
The snapshot source uses `kind: "local-export"` to describe the selector input,
not to claim that the source bank was created locally. The upstream description
is `read-only-database-content-export`. Recorded evidence:

- Export time: `2026-10-20T13:12:02.898Z`.
- Raw UTF-8 export SHA-256: `d13f6c5a880ca09ea971c2453f5b31283f82e212aba76041347f357e17715ade`.
- Blueprint SHA-256: `c5c25fcba923c776c61a3343fe1bc93f6e7d1a5f040038c5ffb1bddf5eb45b16`.
- Selection version: `hamilton-40-lexicographic-uuid-v1`.

The input stays ignored; only the selected IDs and provenance are checked in. The exact input
bytes, including whitespace and row order, determine the export hash. Reordering
input rows leaves question selection unchanged but correctly changes that hash.
Hashes bind an input; they do not independently establish database authenticity.

## Regenerate or verify the original PMLE artifact

Obtain a trusted content-only export with explicit parent provenance through an
authorized process. This selector does not fetch production content. Keep the
input in `.qa/chatgpt-source.json` (ignored), then run from the repository root:

```sh
node scripts/chatgpt/select-free-set.mjs
node scripts/chatgpt/select-free-set.mjs --check
env -i PATH="$PATH" HOME="$HOME" CI=true npm test -- tests/chatgpt-free-set.test.ts
```

Use `--input path/to/local-export.json` for another local export. Use `--output
path/to/snapshot.json` for a separate review artifact. `--check` never writes. The
normal command writes only IDs and metadata to its snapshot output. It never
prints the full bank or updates the input or a database. Review selected IDs,
allocation, and provenance before replacing
the checked-in free set; regenerating after bank changes can change the free IDs.

Tests use synthetic question and option text only. They check the committed
allowlist shape recursively, UUID uniqueness, provenance, canonical Hamilton
quotas, eligibility and policy filters, deterministic UUID selection, tie-breaking,
missing-parent rejection, invalid-option exclusion, and insufficient supply. A
synthetic reconstruction verifies ID order without publishing source content. If
the ignored local export is present, tests additionally require its exact hash and
byte-for-byte regeneration of the IDs-only snapshot. CI without that export cannot
independently revalidate the original upstream inventory or domain assignments;
it validates the public allowlist and selector against synthetic fixtures.
