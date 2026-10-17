# Public samples contract (Track 1)
`content/public-samples/pmle.json`: JSON array, empty or exactly 10 questions.
Each item: `id` UUID (new public-only ID), `domain` canonical PMLE domain code (from lib/constants/pmle-blueprint.ts), `stem` nonempty string, `options` object with nonempty A/B/C/D strings, `key` one of A/B/C/D, `rationale` object with nonempty A/B/C/D strings, `officialDocs` nonempty array of `{title: nonempty string, url: https Google Cloud docs URL}`. All fields required; no extra fields. IDs unique.
No DB ingest; file loads only in public page. Local collision test checks every bank status, not only ACTIVE. Ten reviewed questions are now populated. Their source bank rows must be retired by the coordinator at merge; the private source mapping must not be committed.

## Example shape (not a publishable question)
```json
{"id":"00000000-0000-4000-8000-000000000001","domain":"MONITORING_ML_SOLUTIONS","stem":"Scenario and decision?","options":{"A":"First approach","B":"Second approach","C":"Third approach","D":"Fourth approach"},"key":"B","rationale":{"A":"Why not A","B":"Why B","C":"Why not C","D":"Why not D"},"officialDocs":[{"title":"Monitoring documentation","url":"https://cloud.google.com/vertex-ai/docs/model-monitoring/overview"}]}
```
Run `npm test -- tests/public-samples.test.tsx tests/public-samples-bank.test.ts` before publishing. The bank test uses local Supabase CLI status without printing keys. It skips when local DB is unavailable. Do not publish any ID already in any bank status. This ID-only check does not prove textual separation when public UUIDs are new, and it does not verify production source-row retirement. The data file is never ingested by this page.
Quick-check links stay on `/diagnostic`; add 5/10 labels only after the conversion PR makes them available.
