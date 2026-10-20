# PDE retry runner: offline 40-plan preview

Command from repository root (use a fresh tag if artifacts already exist):

```sh
env -i PATH="$PATH" HOME="$HOME" content-pipeline/scripts/run-domain-batch.sh \
  all pde-pinned-retry-preview data-engineer --count 40 --plan-only
```

Observed exit code: 0. The saved local artifact contains 40 slots,
section counts **9/10/8/6/7**, all **nine pinned topic hints**, and new PDE
style policy **5.3**. It contains no candidates and no generation runs.
No model, document, export, database or persistence work occurs in plan-only mode.
This establishes planning only, not accepted-output coverage or live model quality.

Accepted-output behavior is tested offline with synthetic generation, proof,
writer and critic outputs, real immutable requests and admission checks, and
mock persistence. The bounded runner's report distinguishes admitted from
persisted DRAFT coverage, attempts exhausted, and section shortfalls.

The default two extra attempts permit at most 120 candidate pipelines for a
40-slot initial plan. The existing three decision attempts per candidate and all
gates remain unchanged. This can increase work; no yield or cost saving is claimed.

Required repository gate (from `content-pipeline`):

```sh
env -i PATH="$PATH" HOME="$HOME" uv run pytest -q
```

Observed result: **2,736 passed, 3 skipped, 48 subtests passed** in 75.25 seconds.
There were 25 dependency deprecation warnings. Source Python hashes stayed
unchanged throughout this gate. No live semantic quality or acceptance-yield
claim follows from these offline tests.
