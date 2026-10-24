# Blind Argon v6 contract

New generation freezes `execution_policy: short_circuit_v2`. With `--argon-gate`,
`build_request` exports Argon request version **3** containing separate `blind`
and `review` calls. The blind prompt uses only the stem and deterministic
learner-only shuffled choices. It contains no key, rationales, objective, docs,
receipts, or other verdicts. Argon review remains an independent fresh call.
No model or live calls were used to implement or test this policy.

## Execution and admission

Order: Claude style → evidence → Claude blind → Argon blind → Argon review.
The existing frozen full-judge sample still runs all seats (default every fifth
candidate). Other candidates stop after a substantive veto. Skips reject; they
cannot supply a passing seat. A v3 blind veto may produce an explicit review skip:
`{"status":"skipped","reason":"prior_gate_failed","gate":"argon.blind"}`.
A sampled later system failure retains `quality_rejected: true` in `.failures`
when an earlier evaluated seat already vetoed; callers must not retry that
unchanged candidate to reroll the veto. New failure records always include the
boolean (`false` when no evaluated seat vetoed). Legacy records without it are
unknown, not a safe retry authorization.

Both blind results must strictly PASS, map to the canonical key, have confidence
≥0.8, and deny ambiguity. Every required review/style/evidence field still
passes independently. Malformed/missing results, uncertainty and errors reject.
Raw provenance binds the Argon result to the complete frozen Argon request.

Historical absent-policy Argon v1 and `short_circuit_v1` review-only v2 requests
keep their export bytes and DRAFT-ingest behavior. **Neither can publish under
v6.** Do not relabel old requests or verdicts. Re-export a new cohort and judge
all seats instead. `verify_batch.py` is diagnostic, not publication authority.

## Publisher interfaces

- `shared.external_judge.BLIND_ARGON_POLICY == "short_circuit_v2"`.
- `require_publishable_request(request) -> None` raises `ValueError` unless the
  frozen request has the new policy, rules-v5 gate schemas and Argon v3 schemas
  for both calls. This is necessary, not sufficient, for publication.
- Use ingest `_strict_preflight(path, verdicts, payload)` and
  `_validate_candidate(path, payload, entry)` to validate/rebuild frozen request
  bindings. Use `_external_decision(..., gate_version=2, rules_version=5,
  argon_request=request["argon"])` for strict raw verdict admission. Publication
  additionally needs its own hash-bound DB transition and all publisher checks.
- `shared.argon_gate.evaluate_argon(question, raw, request) -> (bool, str)`
  validates both v3 results and provenance. Missing/malformed data raises
  `CLISchemaError`/`ValueError`; legitimate vetoes return false.

## Canary boundary shared with council health

Keep canary artifacts, requests and verdicts below a **separate directory** with
an on-disk `.council-canaries` marker. The marker is metadata, never judge input.
Requests use exactly the same shape and prompts as ordinary candidates; do not
add `council_canary` to judge-visible requests.

`scripts.ingest_external_verdicts.refuse_council_canary(path, payload) -> None`
raises `ValueError` for marked artifact paths, marked linked
`external_judge_request.path` paths, artifact/candidate `council_canary: true`,
or paths rejected by `shared.council_safety.refuse_canary_paths(*paths)`.
Call it before publication too. Both ordinary ingest and strict preflight call
it before any DB setup or artifact writes. This includes dry runs.

## Coordinator command (not executed here)

With separately authorized credentials and a newly exported cohort:

```sh
cd content-pipeline
uv run python -m scripts.judge_requests --requests <new>.judge-requests \
  --verdicts <new>.verdicts --judge-model claude --parallel 3 --argon-gate
uv run python -m scripts.ingest_external_verdicts --artifact <new>.json \
  --verdicts <new>.verdicts --dry-run
```

Ingest only admits DRAFTs. Use the strict publisher's shadow report before any
separately authorized ACTIVE publication. PROCESS.md edits are coordinator-owned.
