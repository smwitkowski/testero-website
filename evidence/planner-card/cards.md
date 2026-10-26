# Full PMLE frozen cards

**50 eligible; 32 frozen cards; 11 no-card outcomes; 7 unrecovered failures.**
Median: 315 characters. Range: 170–700. Every card passes the 1,200-character, URL, quote, and evaluation-vocabulary lint.

The serial CLI run recorded 32 card proposals, 2 no-card, and 16 exhausted failures across 94 attempts (max 3/objective). Full-source review removed 8 unsafe proposals and resolved 9 captured failures offline (8 cards, 1 no-card). It never reset a retry budget or made another model call. The original run and reviewed outcomes remain separate.

Eligibility is >=3 distinct filtered veto candidates, not a recurring-keyword filter. Every eligible objective was assessed. Coverage claims retain >=2 distinct candidate full-source bindings; shared names alone are not proof. Generic early failure diagnostics cannot recover the discarded provider selections for the 7 remaining failures.

All IDs below have prefix `machine-learning-engineer:standard:`. Full card text lives in external runtime `pmle-planner-cards-v1.json`. `no-card` means no safe repeated coverage claim or relevant dated lifecycle fact; CLI/review identifies when that decision was made.

| ID | Veto candidates | Tries | Outcome / reason |
|---|---:|---:|---|
| 1.1:1 | 9 | 1 | card |
| 1.1:2 | 10 | 1 | card |
| 1.1:3 | 8 | 1 | card |
| 1.1:4 | 8 | 3 | failed: source/JSON lint; exhausted |
| 1.1:5 | 9 | 1 | card |
| 1.2:1 | 8 | 1 | card |
| 1.2:2 | 9 | 3 | failed: source/JSON lint; exhausted |
| 1.2:3 | 6 | 2 | card |
| 1.2:4 | 8 | 3 | failed: source/JSON lint; exhausted |
| 2.1:1 | 10 | 3 | failed: source/JSON lint; exhausted |
| 2.1:2 | 8 | 1 | card |
| 2.1:3 | 8 | 3 | failed: source/JSON lint; exhausted |
| 2.1:4 | 6 | 3 | failed: source/JSON lint; exhausted |
| 2.2:1 | 8 | 1 | card |
| 2.2:2 | 6 | 1 | no-card: no safe claim/fact (review) |
| 2.2:3 | 11 | 2 | card |
| 2.3:1 | 6 | 2 | no-card: no safe claim/fact (review) |
| 2.3:3 | 4 | 1 | no-card: no safe claim/fact (CLI) |
| 3.1:1 | 12 | 3 | failed: source/JSON lint; exhausted |
| 3.1:2 | 8 | 3 | card |
| 3.1:3 | 9 | 1 | card |
| 3.1:4 | 10 | 1 | card |
| 3.2:1 | 7 | 1 | no-card: no safe claim/fact (review) |
| 3.2:2 | 9 | 2 | card |
| 3.2:3 | 7 | 3 | card |
| 3.2:4 | 7 | 3 | card |
| 3.2:5 | 7 | 2 | card |
| 3.2:6 | 7 | 3 | card |
| 3.3:1 | 4 | 3 | card |
| 3.3:2 | 7 | 1 | card |
| 4.1:1 | 8 | 1 | card |
| 4.1:2 | 4 | 3 | card |
| 4.1:3 | 3 | 2 | no-card: no safe claim/fact (review) |
| 4.1:4 | 8 | 1 | card |
| 4.1:5 | 4 | 3 | card |
| 4.2:1 | 8 | 2 | card |
| 4.2:2 | 4 | 1 | card |
| 4.2:3 | 5 | 2 | no-card: no safe claim/fact (review) |
| 4.2:5 | 5 | 1 | card |
| 5.1:1 | 12 | 3 | no-card: no safe claim/fact (review) |
| 5.1:2 | 9 | 1 | card |
| 5.1:3 | 16 | 1 | no-card: no safe claim/fact (review) |
| 5.2:1 | 8 | 1 | no-card: no safe claim/fact (review) |
| 5.2:2 | 10 | 1 | no-card: no safe claim/fact (CLI) |
| 6.1:1 | 9 | 3 | no-card: no safe claim/fact (review) |
| 6.1:2 | 5 | 3 | card |
| 6.1:3 | 9 | 3 | card |
| 6.2:1 | 4 | 1 | card |
| 6.2:2 | 7 | 1 | card |
| 6.2:3 | 6 | 1 | card |

## Three additional random cards

Seed 20261026; `sample(sorted(retained IDs minus original four),3)`. Original four excluded: `1.2:3`, `3.2:6`, `3.3:2`, `5.1:3`. Independent final full-source review approved all three, including every retained clause and original false-proof/source binding.

### 1.1:5

```text
Coverage: The docs here do not establish that retrieval or few-shot prompting with approved examples is inferior to SQL-based Gemini tuning, or that earlier prompt revisions show such examples would fail. The docs here do not establish precision, recall, F1, text-overlap, or tuning loss evaluation for tuned Gemini models in BigQuery ML.
Lifecycle: No dated lifecycle fact selected.
Current names: BigQuery; BigQuery ML; Gemini
```

### 6.1:3

```text
Coverage: The docs here do not establish XRAI as uniquely best for quality-control or manufacturing images, since Integrated Gradients is recommended there and provides OUTLINES visualization of contributing regions.
Lifecycle: No dated lifecycle fact selected.
Current names: Agent Platform; Agent Platform Inference
```

### 2.2:3

```text
Coverage: The docs here do not establish that Model Garden offers the pretrained embedding models needed for notebook prototyping, even though multimodal embeddings and Workbench notebook use are documented.
Lifecycle: No dated lifecycle fact selected.
Current names: Model Garden; Agent Platform Workbench
```

## Frozen provenance

Exclusive cutoff: 2026-10-26T00:00:00Z. Only historical doc-check veto reasons and dated objective-corpus lifecycle spans; experiment/A/B/canary/gold exclusions remain.

- Input audit file SHA256: `afa65fba2b5bbaadbf0101dd75131914e492dc3ea4cfa024813b52055398a530`.
- Reviewed runtime cards file SHA256: `4b491a7ff576451dccf43f5e3d4a76537f264adc70a8b8d3fb760e1c5599cdd1`.
- Full audit/attempts/original selections/review mutations are local under ignored `.cache/optimize/cards-revision/`. No runtime JSON or raw logs are committed.
- Runtime pack/base hashes and current gate: `DELIVERY.md`. Independent sign-off: `revision-review.md`.
