# V5 offline replay

See `../PROCESS.md` for operator flow, calibration limits, thresholds and exact
next commands. Run `uv run pytest -q tests/test_pipeline_v5.py` from the pipeline.

No fresh model calls or DB writes were made. Batch7/8 replay catches one known
pair among 153; it does not prove a general semantic duplicate detector. Argon
review projection/blind replay is test-only, not production gate provenance.

## Coordinator smoke follow-up

`tests/fixtures/v5-smoke-decision-veto.json` records all six proposed decisions
and veto reasons from the coordinator's first three-candidate 2026-10-13 smoke,
plus four vetoed plans from smoke 2, with source SHA256 hashes. Replay uses synthetic fetched official documents to test retrieval
coverage/order and still replays the veto; it does not claim corrected decisions
pass or that live retrieval/model behavior is validated. XGBoost lifecycle and
ambiguous rollout distractor vetoes remain real constraints, not errors to waive.

Smoke 2's recorded shuffled private-endpoint candidate is in
`tests/fixtures/v5-smoke-external-request.json`. Offline reproduction identified
request-size overflow, not a shuffle or dedupe defect. The optional Argon bundle
repeats docs in its review; only an oversized Argon bundle retries all cited
sources with ±4,000-character quote margins after existing ±8,000 windows fail.
The 150,000-character request cap, rubric/schema, verified quotes and original
fetch hashes remain. This builds the replay at 134,329 characters; it does not
exercise the live Argon model. Local request-construction failures now retain
bounded/redacted exception messages; provider exception bodies stay generic.

## Smoke 3 diagnostics and resume replay

Request fixture `v5-smoke3-argon-request.json` is the exact public-content frozen
request for `555ef068-8003-5edc-ad5a-83fd2aa6cc1b`, SHA256
`9878217a2b5f207045a36efa26f9bf65ee707b1557ab21af88ac6414937cfecf`. Credential-pattern check found
no keys; no provider response/log bodies are included. Five synthetic failing
sub-call replays verify safe stage/class messages and candidate-only recovery;
this does not establish which historical live sub-call failed.

`v5-smoke3-candidate-failures.json` records rejected candidates and frozen local
bank with source SHA256. The 4.1:3 proof passed, then dedupe correctly rejected
it at score **0.25** against `420f7f83-b69a-5c8e-9621-b293c171fedc`.
Ingestion had overwritten that stage and three decision vetoes with missing
request errors; replay preserves/restores the true generation rejection stages.
No gates, model choices, quotas, token budgets or dedupe thresholds changed.
