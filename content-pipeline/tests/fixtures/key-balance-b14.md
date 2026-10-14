# b14 key-balance replay

`key-balance-b14.json.gz` is deterministic gzip (mtime 0), decoded by
`tests/test_key_balance.py`. Source: `pmle-d033-v5-monitoring-30-b14.json`,
SHA256 `4c06e2ca35db5b11c710deb003d812705f30e94582884b921dea52c07f2f88bd`.

The projection retains the 13 recorded all-four-gate passing candidates, their
allowlisted content/provenance fields, frozen official source bodies, exact judge
request bytes and recorded verdicts. It omits generation/citation attempts, the
bank export and persistence journals. The full plan remains to validate original
indices/scopes. No API keys, transport logs or environment files are included.
No new model calls or live database writes produced this fixture.

Before ingest, stored keys are A=0, B=7, C=3, D=3. After balancing this cohort,
A=3, B=4, C=3, D=3; maximum 4 = ceil(13/4). Tests extract the judged correct-answer
text from the frozen evidence prompt and compare it with every mocked DB answer
marked correct. Frozen canonical questions, rationales, receipts and raw verdicts
are unchanged. Measured word-length ranks use shortest-rank ties, not authoring
hints. Mocked persistence does not establish live DB or model quality validation.
