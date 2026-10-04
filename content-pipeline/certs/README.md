# Official certification registry

Phase 1 research only. The live product remains PMLE-only.

## Rebuild and check

Run from `content-pipeline/` in the existing project environment:

```sh
uv run python scripts/refresh_cert_registry.py --refresh
uv run python scripts/refresh_cert_registry.py --no-network --check
uv run pytest -q
```

`--refresh --check` fetches sequentially and reports drift without publishing JSON.
Exit codes: `0` means no drift (or a successful write), `1` means drift in check
mode, and `2` means a source/cache/parser failure. Use `--help` for path options.
No API key, generator import, dotenv loading, database, or model call is needed.
PDF extraction requires `pdftotext` (locally `/opt/homebrew/bin/pdftotext`).

The gitignored `.cache/cert-registry/` contains raw HTTP, URL/hash receipts,
PDF text and a request manifest. A fresh checkout must first use `--refresh`.
Offline mode never falls back to HTTP. Sources are parsed completely before
publishing; a missing or invalid source fails the refresh rather than publishing
an incomplete outline. No-change reruns retain the tracked snapshot's retrieval
timestamps; fresh fetch receipts remain in the local cache manifest.

## Read the records

- `registry.json` indexes current catalog entries. Each named JSON holds one
  complete certification, ordered section/subsection/objective outlines, published
  weights, official format facts, variants, sample links and source provenance.
- Standard, renewal, skills-renewal, beta and upcoming versions are distinct.
  Listing does not prove registration is open. Unknown facts remain `null` with
  notes. An as-of date is not an exam effective date; filename dates are not facts.
- Approximate published weights are not normalized, even when their sum is 101.
- Ordinal objective IDs are version-local locators, not stable identities across
  revisions. A Phase 2 adapter needs reviewed aliases and canonical domain mapping.
- Catalog removal is reported as unverified, not inferred retirement. Historical
  retirement coverage is incomplete without an explicit official notice.

See [`STYLE.md`](STYLE.md), [`PMLE-DRIFT.md`](PMLE-DRIFT.md),
[`GAPS.md`](GAPS.md) and the nine-step [`PROCESS.md`](../PROCESS.md).
Do not commit raw sample questions, options, answer keys or case-study prose.
