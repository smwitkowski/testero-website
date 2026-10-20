# ChatGPT fixed free question set (D-042)

`lib/chatgpt/free-set.json` is the authoritative 40-question ID allowlist in this
public repository. Its exact shape is `{version: 1, source: {...}, question_ids:
[...40 UUID strings]}`. `source` contains only export and selection provenance:
`kind`, `upstream`, `exported_at`, `export_sha256`, `blueprint_sha256`, `selection`.
It contains no stems, options, correct flags, explanations, domain assignments, or
per-question eligibility flags. Do not check in any full-bank or selected-content
export. The ignored local source is content, not a credential or secret.

## Runtime loading

`lib/chatgpt/questions.ts` uses `import "server-only"` and loads content through
the server Supabase client only for allowlisted IDs. Both its query and returned-row
validation enforce the PMLE, ACTIVE, GOOD, and explicit original-parent filters.
It validates A–D options, a boolean single correct flag, full explanations and the
literal policy filter below. It fails closed for missing or ineligible content,
never substitutes another bank question, and discards expired cached content
before refreshing. Validated content is cached per instance for up to 30 seconds.
Eligibility changes can therefore take up to 30 seconds to appear. The public
allowlist is not proof of current database eligibility.

Question-serving tools must omit every `is_correct` and `explanation`;
answer-checking tools may reveal those fields only for the submitted question.
See `docs/chatgpt-mcp-verification.md` for the implemented helper and gate evidence.

## Selection rule

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

Eligibility requires all of:

- `exam === "GCP_PM_ML_ENG"`, `status === "ACTIVE"`, `review_status === "GOOD"`.
- Explicit `parent_question_id === null`; variants are never eligible.
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

## Source and provenance

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

## Regenerate or verify

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
