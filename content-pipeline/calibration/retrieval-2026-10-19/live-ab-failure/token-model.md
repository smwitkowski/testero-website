# Offline token model

No live calls, environment reads, or database access. New repair costs and yields are modeled, not provider measurements.

## Observed calls

| Arm/stage | Calls | Input incl. cache | Output | Cache read | Cache creation |
|---|---:|---:|---:|---:|---:|
| baseline/plan | 27 | 569,410 | 51,504 | 48,000 | 0 |
| baseline/verify | 27 | 2,722,209 | 8,854 | 0 | 0 |
| baseline/write | 6 | 185,415 | 11,678 | 0 | 0 |
| baseline/judge_style | 6 | 77,669 | 5,431 | 23,452 | 54,201 |
| baseline/judge_evidence | 6 | 193,084 | 4,732 | 83,188 | 109,870 |
| baseline/judge_blind | 6 | 39,082 | 1,951 | 20,942 | 18,124 |
| baseline/argon_review | 6 | 75,322 | 318 | 0 | 0 |
| treatment/plan | 36 | 761,688 | 68,954 | 240,000 | 0 |
| treatment/verify | 36 | 1,612,823 | 9,804 | 112,896 | 0 |
| treatment/write | 1 | 31,127 | 1,837 | 0 | 0 |
| treatment/judge_style | 1 | 22,690 | 1,214 | 14,124 | 8,560 |
| treatment/judge_evidence | 1 | 37,450 | 944 | 21,005 | 16,439 |
| treatment/judge_blind | 1 | 4,773 | 254 | 2,206 | 2,565 |
| treatment/argon_review | 1 | 12,456 | 53 | 0 | 0 |

Codex input already includes cache reads: do not add them again. Claude native input excludes cache read and creation: reported input here sums all three. Output includes provider reasoning where present; reasoning is not added again. Cache columns are subsets of normalized input, not extra tokens. Token counts are not dollar costs (different models/cache rates).

Baseline total: 3,862,191 input + 84,468 output = 3,946,659. Treatment: 2,483,007 + 83,060 = 2,566,067.

Baseline had 27 verify attempts, 6 verify survivors and 5 external judge passes. Treatment had 36 verify attempts and 1 survivor, but the frozen validator bug blocked final acceptance. External judge passes are not independently established production accepts. Baseline uses 772,438.2 input tokens per external judge pass, or 789,331.8 input+output tokens including plan, verify, write, judges and argon review. Treatment has no valid accepted denominator.

## Repair estimate and assumptions

Selected report covers 63 attempts. Its per-attempt full/cheap estimates use chars/4, not provider tokens. Sums: baseline {'full_estimated_tokens': 2804151, 'cheap_estimated_tokens': 1195017}; treatment {'full_estimated_tokens': 6691723, 'cheap_estimated_tokens': 1716582}. These are kept separately from actual measurements.

Baseline cheap/full ratio = 0.426160004. Apply only to observed baseline verify input: 2,722,209 × 0.426160004 = 1,160,096.597. Keep all other input unchanged at 1,139,982. Thus I(E,C) = 2,300,078.597 + E × C. C is incremental full-call input, default 100,000. This aggregate rescaling is a rough proxy, not an exact tokenizer or prompt reconstruction.

Historical missing-evidence proxy flags 8 baseline candidates and 12 treatment candidates. Cap at one escalation per candidate; do not count each retry as a separate escalation. The flags are historical proxies, not measured future escalation rates. A treatment-like workload may therefore escalate all 12 candidates.

Assume unchanged baseline survival 6/12 and external-judge pass 5/6: 12 × (6/12) × (5/6) = 5 modeled accepts. This is not actual repair yield. At 0 accepts, tokens/accepted is infinite regardless of token savings.

| Escalations (of 12) | Input at 100k/call | Input / 5 modeled accepts | Baseline/input ratio |
|---:|---:|---:|---:|
| 0 | 2,300,078.6 | 460,015.7 | 1.679× |
| 3 | 2,600,078.6 | 520,015.7 | 1.485× |
| 6 | 2,900,078.6 | 580,015.7 | 1.332× |
| 8 | 3,100,078.6 | 620,015.7 | 1.246× |
| 12 | 3,500,078.6 | 700,015.7 | 1.103× |

Output sensitivity: conservatively retain baseline output 84,468 and add 328 tokens per escalation (baseline verify output 8,854/27 ≈328). At E=8,C=100k: (3,100,078.597 + 84,468 + 8×328)/5 = 637,434.119 input+output per modeled accept; at E=12: 717,696.519. These output assumptions are not provider measurements.

Full-call cost sensitivity at 12 escalations: 50k gives 2,900,078.597 input (580,015.719/accept); 100k gives 3,500,078.597 (700,015.719/accept); 200k gives 4,700,078.597 (940,015.719/accept), worse than baseline. All scenarios retain the same downstream workload and output assumptions; changed survival/retry behavior could change both.

**Conclusion:** 3–5× total tokens-per-accepted improvement remains unproven. Even zero escalations gives only 1.679× modeled input reduction under these conservative assumptions; the baseline-proxy 8 escalations gives 1.246×. The support report is analyst calibration, not held-out quality or demonstrated acceptance.
