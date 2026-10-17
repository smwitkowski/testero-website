# Retrieval artifact measurement (offline, 2026-10-17)

Scope: baseline `ab-1017-baseline.json`, treatment `ab-1017-treatment.json`, and 22 `pmle-d033-v5-*.json` artifacts. No network calls.

| Arm | Candidate count | Attempt count | Source occurrences | Unique requested URL | Unique final URL | Changed-URL occurrences / pairs | Lexical coverage-veto attempts / candidates |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 12 | 27 | 271 | 123 | 121 | 20 / 14 | 19 / 9 |
| treatment | 12 | 25 | 259 | 149 | 148 | 17 / 13 | 14 / 8 |

All 24 artifacts: 9,355 serialized decision-attempt source occurrences; 637 URL-change occurrences and 156 unique requested/final pairs. These are not counts of HTTP calls. Candidate-level source/evidence projections are excluded to avoid double counting.

**Unknown:** discovered URL count, fetch-error count, 404 event count and failure-to-veto causal attribution. Artifacts serialize successful source text, requested/final URLs, retrieval timestamp and text hash, not discovery lists or failures. There are zero standalone 404 tokens in non-body scalar fields; this does not establish zero HTTP failures. No artifact-adjacent `.log`, `.stdout`, `.stderr` or stdout/stderr-named files were present in the three generation directories or their immediate `.cache` parents.

Recorded final URL changes do not establish HTTP redirect status/hops. Example: `https://docs.cloud.google.com/agent-assist/docs/cmek` → `https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/cmek`. No 404 mapping is established.

Coverage-veto counts are lexical matches in rejecting decision-attempt proof reasons. Full reasons and JSON locations remain in the local audit; matches can discuss missing support without a preceding fetch failure and do not prove causality.

## Reproduction and provenance

From the retrieval worktree: `cd content-pipeline && uv run python scripts/audit_retrieval_artifacts.py`. This reads fixed sibling artifact paths and writes only `.cache/retrieval-audit/` notes. Detailed per-artifact/group counts, URL paths and locations are in `artifact-audit.json`. No raw document text is copied into the audit. Source SHA256s:

- `ab-1017-baseline.json`: `059c7dd4a6abd7a8db2a6dc06852e109167037de4b03c054520029e72b1aa79b`
- `ab-1017-treatment.json`: `4dd9deba4b2e78c53a74c9729587d65f7e8f18fb50b21b1eed7c666cab6c53e8`
- `pmle-d033-v5-collab-30-b12.json`: `ba905f42dcf0537bf6616f8cf05953306202c7c0b113080ca18a00170656abb4`
- `pmle-d033-v5-collab-30-b17.json`: `f68676d211db076ca1f0cbf07692f452ab35307ea1920d81fcc474f10db33d9c`
- `pmle-d033-v5-collab-30-b24.json`: `2eb7913ef5a9c71bcd45f0ee9f6a34399b31c42bc6edc7d5607ad10cb967c737`
- `pmle-d033-v5-lowcode-30-b11.json`: `2a5ae26cfa938e80003a32a60db1ea2db926ee096e2a947ad04a760f5acf1a1e`
- `pmle-d033-v5-lowcode-30-b16.json`: `7ca4b12093c291b5e6866a6f699c2e22f11446ea93433e542d8973dc3a72198e`
- `pmle-d033-v5-lowcode-30-b16r.json`: `c0d743f19a1e68abe715ee8777cf832f0a97b732142886c6f73970d5b2b0488c`
- `pmle-d033-v5-lowcode-30-b21.json`: `34fedf35cbcd0afa041987d971d2e3d951f51aaec9a01fec9db49ebf71744b01`
- `pmle-d033-v5-monitoring-30-b14.json`: `4fe815ec3f3acec4bc190fcb8282f86ec428a38497f3b873f7bb8511af22f219`
- `pmle-d033-v5-monitoring-30-b27.json`: `b5272673fe355238fc40fc20e893c6ad2efc13d5e0755d6d9a77c504b7a95d7f`
- `pmle-d033-v5-pipelines-30-b13.json`: `e0c8dd20407bc95c5518185465362774f2426eebd3ccc931c1bdaaf1791d5eea`
- `pmle-d033-v5-pipelines-30-b18.json`: `7f98428139296514182723045c256de83d5af3d8f02b6dc61d6da2de2b0bf23e`
- `pmle-d033-v5-pipelines-30-b20.json`: `7f45b6829d5a2924431105711115592bd9885d573ca3f02ce6a2760c313ec6b5`
- `pmle-d033-v5-pipelines-30-b20r.json`: `bb314783686dec626311cdfe86a0469c48baac86c4fced129e3b1c9eb6433f99`
- `pmle-d033-v5-pipelines-30-b20s.json`: `721981738cd2c59911df3fe56704a738f0d42d5bb37e727423abb51ca160448a`
- `pmle-d033-v5-pipelines-30-b20t.json`: `368b392297be98b4215957b74ee963b8f2733ae341b01f2096240f0c29951c11`
- `pmle-d033-v5-scaling-12-b23.json`: `fbd24c03497351b80f2113e5204a94fc82d6f4ff52fcff1d0e65c21394d62fea`
- `pmle-d033-v5-scaling-12-b25.json`: `e4a9d28ff292d0c887f55508f4330b437e3aa9828680a55e54c605479e1870d7`
- `pmle-d033-v5-scaling-30-b10.json`: `1392e06dd2b6bc91757a8d5c8c50851550d73ef7233409c77ddf98687add4038`
- `pmle-d033-v5-scaling-30-b15.json`: `e376b5eed5dfa71b658713891c64b13fdd4ce180a9a46fd347586de686f3d487`
- `pmle-d033-v5-scaling-30-b19.json`: `35fd724c6dbac28cea0caf56e3227732995359172c6ce2a5e4f129c8d60ea778`
- `pmle-d033-v5-scaling-30-b22.json`: `8f3160622ebce6d155fe9716a35b5a8034d31e8fee9a7a03b395f1f38380c24c`
- `pmle-d033-v5-serving-30-b26.json`: `b453bf4a381dd6ee3a2b135de51579fd00aa2e564f6519b5e896af55a93fa982`

## Separate public HTTP fixture capture (not historical batch statistics)

On 2026-10-17, four public unauthenticated URL probes recorded three initial
404s and one 301 followed by 200. Tests replay sanitized fixtures, not the network:

- `/gemini-enterprise-agent-platform/models/tuning/distillation`: 404.
- `/vertex-ai/models/tuning/distillation`: 404 (direct alias does not fix this URL).
- `/gemini-enterprise-agent-platform/generative-ai/docs/models/tune-models`: 404;
  its Vertex alias below succeeds via an official redirect.
- `/vertex-ai/generative-ai/docs/models/tune-models`: 301 to
  `/gemini-enterprise-agent-platform/models/tuning`, then 200.

All use `https://docs.cloud.google.com`. This proves only these responses at capture
time, not failure frequency in prior batches or semantic coverage for distillation.
