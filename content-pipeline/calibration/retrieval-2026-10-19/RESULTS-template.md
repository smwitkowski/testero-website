# Retrieval A/B results — TO BE RUN BY COORDINATOR

Status: **not run**. Retrieval remains default-off. Offline quote recall is not semantic quality approval.

## Frozen setup
- Commit / implementation hash:
- Bank SHA256 / guide hash:
- Cert / objectives / actual allocation and rotations per arm:
- N per arm / seed / model / effort / parallelism:
- Both arms: distractor evidence **consistent**, three decision attempts, all independent judge gates (`--full-gate-sample 1`).
- Baseline: all retrieval-experiment flags off. Treatment: disk cache + BM25 passages + stable prefix on.
- Cache cold/warm at start (do not silently prewarm treatment):
- Arm order / repeated paired run IDs:
- Both b28/ACE-b2 replay hashes / recall / stable-prefix mode / selected config and cap / explicit exploratory override if gate failed:

## Primary outcomes
| Metric | Baseline | Treatment | Change / denominator |
|---|---:|---:|---|
| Initial candidates / written / external-ready | | | |
| Independently accepted after all gates / yield | | | accepted / initial candidates |
| Generation input + output tokens per accepted | | | NULL when zero accepted |
| Plan tokens per accepted / calls / attempts | | | |
| Verify tokens per accepted / calls / attempts | | | |
| Write + cite tokens per accepted / calls | | | |
| Judge tokens per accepted, by style/evidence/blind/Argon | | | normalize provider accounting first |
| All tokens per accepted | | | known coverage; not publication |
| Style pass rate | | | pass / actually evaluated |
| Evidence pass / UNCERTAIN rate | | | pass / actually evaluated |
| Claude blind pass rate | | | pass / actually evaluated |
| Argon PASS / REVISE / REJECT | | | per actually evaluated review |
| All-gate overlap pass rate | | | full-gate sample only |
| Generation / judging / total wall seconds | | | from manifest |
| Cached input share, generation overall and by stage | | | OpenAI cache_read / inclusive input |
| Anthropic cache-read / cache-write / uncached input | | | separate native fields; total = all three |
| Calls missing usage / failed calls | | | missing != zero |
| Vetoes by cause / third-attempt passes | | | |
| Context chars p50/p95/max / selected chunks | | | doc tokens are estimates |
| Quote recall per A/B/C/D / source URL | | | original recorded receipts only |
| Near-duplicate / mechanical evidence / key-balance fails | | | |

## Safety / acceptance decision
- Target >=3x lower tokens per accepted (aspiration 5x), without lower quality.
- Normal A/B tooling requires >=95% on both frozen calibration sets with current exact config/cap/code. Selected b28=57/60,ACE-b2=50/52. Neither is held-out after tuning; get fresh held-out receipts before rollout.
- Stop on unsupported key/changed gate policy/credible Argon-quality regression. Small N cannot establish noninferiority or a ±5-point quality change.
- Inspect matched objective cohorts and all-gate quality; retain all four mandatory gates, no publication or DB write in this script.
- State unknown token fields, schema normalization, zero-acceptance ratios and any incomplete stage explicitly.
- Decision: keep default-off / revise ranker / approve next controlled experiment (no merge authorization implied).
