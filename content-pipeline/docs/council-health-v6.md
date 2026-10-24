# Council health: isolated canaries and gold replay

`scripts/council_health.py` defaults to offline work. `prepare` reads accepted
frozen candidates and builds requests. `evaluate` reads frozen full verdicts.
Neither command generates questions, fetches docs, loads `.env`, ingests rows,
or constructs a database/model client. Only `live` runs model calls. This is a
coordinator-only operation and needs an explicit approval flag.

## Prepare canaries (offline)

Run from `content-pipeline`. Supply artifact paths from the artifact-owning
checkout. Outputs must be new directories, separate from ordinary batches.
Do not put monitor requests in an ingest batch.

```sh
uv run --frozen --offline python scripts/council_health.py prepare \
  --artifact /absolute/path/accepted-batch.json \
  --out .cache/council-health/week-01-canaries --seed 45 --per-type 20
```

Repeat `--artifact` to draw from several accepted frozen batches. Only candidates
with literal `accepted: true` are sources. Rejected/awaiting candidates cannot
become gold or canary parents. Persisted sources are read-only. No generation
or persistence journal is copied into an ingestable artifact.

The two shipped defects are:

- `swapped_key`: swap the canonical key with a seeded distractor, including its
  explanation and evidence-label binding. The original correct answer becomes
  a distractor. No sources or receipt quotes are fabricated.
- `retired_name`: replace a current product name in learner prose with its
  retired/renamed lexicon entry. If no name matches, add ordinary Google Cloud
  environment context using a retired/renamed name. Deterministic freshness
  rejects both classes under the publisher's rule.

The second-defensible-option mutation is deferred. It needs a real, validated
semantic rewrite; duplicating an option is not a useful substitute.

The seed controls sampling, mutation selection, and opaque UUID identities.
Use a fresh seed for each independent cohort. Use diverse accepted source
batches; repeating a small source set is not evidence of broad defect coverage.
A retry of the same frozen cohort must keep its seed, requests and verdicts.

Each cohort contains:

```text
.council-canaries       # hard monitor-only barrier, also used for gold
manifest.json          # private roles, source hashes, questions, request hashes
requests/<uuid>.json   # standard build_request shape, no monitor role metadata
verdicts/<uuid>.json   # created only by live judging or supplied frozen replay
```

The request schema and independent gates are identical to ordinary current
candidates: `build_request`, rules v5, `short_circuit_v2`, and Argon v3 blind plus
review. Both blind seats see shuffled learner views without the key,
explanations, citations, source IDs, or canary identity. Private manifests and
markers never enter the model prompt. The manifest is not an ingest artifact.
The ingest and publisher refuse marker-bearing paths before constructing DB
clients, including dry runs. Symlink paths are refused.

## Live judge step (coordinator only)

The worker did **not** run this command. Existing runtime credentials and budget
approval are required. It does not ingest, publish, or update the database.

```sh
uv run --frozen --offline python scripts/council_health.py live \
  --root .cache/council-health/week-01-canaries --coordinator-approved
```

This runs every council seat (`full_gate_sample=1`). A short-circuited/incomplete
verdict is an observation error, not a proven catch. Auth, provider, quota,
missing-file and schema failures cannot inflate the catch rate.

## Evaluate frozen verdicts (offline)

```sh
uv run --frozen --offline python scripts/council_health.py evaluate \
  --root .cache/council-health/week-01-canaries \
  --state .cache/council-health/state.json \
  --pause .cache/council-health/PIPELINE_PAUSED --window 20
```

`--verdicts` can point at a separate recorded verdict directory. Requests are
hash-checked and rebuilt against frozen manifest question/source/receipt data.
A single shared `publish_batch.publication_errors` helper decides whether the
candidate would publish. `verify_batch.py` is not used. Monitor evaluation does
not weaken schemas or fabricate missing legacy blind answers. Monitor-only
escapes use the same unanimous council/freshness rule, not outer DB admission
rules, because canaries never have DB rows.

The default state is `hq/tools/council-health.json`, relative to the Testero
project containing this checkout. The default pause path is `PIPELINE_PAUSED`
beside the state file. Local tests always pass worktree-local temporary paths.
Changing the configured rolling window requires explicit state migration.
Windows smaller than 20 are refused. State writes use atomic replacement and
an exclusive file lock. Re-evaluating a cohort does not increase sample counts.

A canary that would publish pauses immediately, even before the window fills.
A catch rate below 95% pauses once a type's window fills. Exactly 19/20 catches
is 95% and does not itself pause, but any newly observed escape already pauses.
Both defect types keep separate rolling windows. A pause is sticky: the monitor
never deletes an existing pause file. Only the coordinator can clear it after
investigation. Exit 1 means paused or incomplete; exit 2 means invalid input.
The JSON report includes counts, rates, pause reasons, incomplete observations,
and page reasons. No reports are sent externally by this script.

## Gold replay

Select the D-029 pilot 12 and the accepted PDE set from their actual saved
artifacts. This checkout does not contain those full artifact sets. There is
no fabricated gold default or claim that the live replay has completed.

```sh
uv run --frozen --offline python scripts/council_health.py prepare --gold \
  --artifact /absolute/path/accepted-d029-pilot.json \
  --artifact /absolute/path/accepted-pde-set.json \
  --out .cache/council-health/week-01-gold --seed 45
uv run --frozen --offline python scripts/council_health.py live \
  --root .cache/council-health/week-01-gold --coordinator-approved
uv run --frozen --offline python scripts/council_health.py evaluate \
  --root .cache/council-health/week-01-gold \
  --state .cache/council-health/state.json
```

Gold uses newly exported current full council requests, not review-only v5
requests. It uses the same strict helper. Gold pass rate below 80% creates a
page reason in the report, never a pause. Existing canary pauses remain in
force. Missing/malformed results are incomplete observations, not gold fails.
The nightly coordinator dispatches report page reasons through its alert path.

## Offline evidence

```sh
uv run --frozen --offline pytest -q tests/test_council_health.py
```

Tests rebuild monitor requests from exact recorded accepted questions, sources,
and receipts in `bank_grounding_replay.json`. Another test replays recorded
blind answers from `efficiency-judge-replay.json`, transporting the selected
option text through the deterministic mutation shuffle, and verifies that it
no longer equals the swapped key. This is deterministic replay, not a live
canary-quality measurement. Threshold, pause and rolling-state tests use
explicit synthetic boundary verdicts. They are not model-quality proof.
