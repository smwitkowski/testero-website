# PDE 40-candidate offline plan preview

This is a plan, not 40 generated or accepted questions. It contains no question
text, marked answers or judge decisions. No model, document retrieval or database
call ran. Seed: `42`; generation policy: `pde-v1`; style policy: `5.2`.

Reproduce from `content-pipeline/` with a **fresh artifact path**:

```sh
env -i PATH="$PATH" HOME="$HOME" uv run python scripts/generate_all_domains.py \
  --cert data-engineer --n-questions 40 --seed 42 \
  --model codex --judge-model external --argon-gate --plan-only \
  --artifact .cache/generation/pde-plan40-preview.json
```

## Section distribution

| Section | Guide weight | Planned candidates |
|---|---:|---:|
| 1. Designing data processing systems | 22% | 9 |
| 2. Ingesting and processing the data | 25% | 10 |
| 3. Storing the data | 20% | 8 |
| 4. Preparing and using data for analysis | 15% | 6 |
| 5. Maintaining and automating data workloads | 18% | 7 |
| **Total** | **100%** | **40** |

## Required-topic reservations

These are topic **hints**, not proof of generated or accepted coverage. Each is
bound to an existing reviewed guide objective. The other 31 slots retain the
seeded guide-objective rotation within their weighted section.

| Required topic | Reserved slots |
|---|---:|
| Dataflow streaming windows, triggers and late data | 1 |
| Bigtable vs Spanner vs BigQuery storage choice | 1 |
| Dataplex governance | 1 |
| Datastream replication | 1 |
| Sensitive Data Protection / masking | 1 |
| Analytics Hub sharing | 1 |
| Dataproc vs Dataflow | 1 |
| Composer orchestration | 1 |
| ML / embedding data preparation | 1 |
| Other guide-objective slots | 31 |

## Format and cap

- `What should you do?`: 34/40 hints (85%).
- Short stems: 8/40 hints (30–50 words, target 40).
- Other stems: 32/40 hints (target 60; hard limit 85).
- Options target 15–22 words; four choices, one answer only.
- A named product may occur in at most 16 correct actions at N=40.
  Actual product distribution **cannot be checked in a plan-only preview**.
  Generation checks reservations; ingest checks the actual eligible population.
  A smaller accepted set cannot use 40 as its denominator. Small populations use
  `max(1, floor(0.4 * N))`. Ambiguous or missing product attribution blocks.
- Duplicate and quality gates have not run on questions because none exist.

## Frozen slot list

Objective IDs below use the prefix `data-engineer:standard:`. Required-topic
reservations do not imply that other slots lack a topic; they still test their
selected guide objective.

| Slot | Section | Objective suffix | Required-topic hint | Stem target |
|---:|---:|---|---|---:|
| 1 | 1 | `1.4:2` | Datastream replication | 40 |
| 2 | 1 | `1.1:5` | Guide objective | 60 |
| 3 | 1 | `1.1:6` | Guide objective | 60 |
| 4 | 1 | `1.1:7` | Guide objective | 60 |
| 5 | 1 | `1.2:1` | Guide objective | 60 |
| 6 | 1 | `1.2:2` | Guide objective | 40 |
| 7 | 1 | `1.2:3` | Guide objective | 60 |
| 8 | 1 | `1.2:4` | Guide objective | 60 |
| 9 | 1 | `1.2:5` | Guide objective | 60 |
| 10 | 2 | `2.1:1` | Guide objective | 60 |
| 11 | 2 | `2.1:2` | Guide objective | 40 |
| 12 | 2 | `2.1:3` | Guide objective | 60 |
| 13 | 2 | `2.1:4` | Guide objective | 60 |
| 14 | 2 | `2.2:1` | Guide objective | 60 |
| 15 | 2 | `2.2:2` | Dataproc vs Dataflow | 60 |
| 16 | 2 | `2.2:3` | Guide objective | 40 |
| 17 | 2 | `2.2:3:1` | Guide objective | 60 |
| 18 | 2 | `2.2:3:2` | Dataflow streaming windows, triggers and late data | 60 |
| 19 | 2 | `2.2:3:3` | Guide objective | 60 |
| 20 | 3 | `3.4:1` | Dataplex governance | 60 |
| 21 | 3 | `3.4:2` | Guide objective | 40 |
| 22 | 3 | `3.1:1` | Guide objective | 60 |
| 23 | 3 | `3.1:2` | Bigtable vs Spanner vs BigQuery storage choice | 60 |
| 24 | 3 | `3.1:3` | Guide objective | 60 |
| 25 | 3 | `3.1:4` | Guide objective | 60 |
| 26 | 3 | `3.2:1` | Guide objective | 40 |
| 27 | 3 | `3.2:2` | Guide objective | 60 |
| 28 | 4 | `4.1:5` | Sensitive Data Protection / masking | 60 |
| 29 | 4 | `4.3:4` | Analytics Hub sharing | 60 |
| 30 | 4 | `4.2:2` | ML / embedding data preparation | 60 |
| 31 | 4 | `4.3:1` | Guide objective | 40 |
| 32 | 4 | `4.3:2` | Guide objective | 60 |
| 33 | 4 | `4.3:3` | Guide objective | 60 |
| 34 | 5 | `5.2:1` | Composer orchestration | 60 |
| 35 | 5 | `5.2:2` | Guide objective | 60 |
| 36 | 5 | `5.3:1` | Guide objective | 40 |
| 37 | 5 | `5.3:2` | Guide objective | 60 |
| 38 | 5 | `5.4:1` | Guide objective | 60 |
| 39 | 5 | `5.4:2` | Guide objective | 60 |
| 40 | 5 | `5.4:3` | Guide objective | 60 |

Guide SHA256: `2894c67e980d162e8198c1feb69cee8f450c50b65394e91bc36a983504658281`.

Generation-config SHA256: `7218575b5354444007993dd7677e11c36199b5bc20b727efd1e5c76fb63457cc`.
