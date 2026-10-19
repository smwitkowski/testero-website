# Documentation efficiency calibration — 2026-10-19

Experiment outputs and detailed reports are archived outside this repository at:
`../hq/drafts/retrieval-calibration-2026-10-19/` (relative to the frontend worktree).
The archive preserves the original directory layout and file bytes, including
`live-ab-failure/` and the 467-line `veto-analysis.md`.

## Findings

- Only local document caching and content-identical plan/verifier field ordering
  are enabled by default. Passage retrieval and escalation remain off; decision
  attempts remain three. Full-document verification and independent gates remain.
- Historical receipt-only replay recovered 57/60 b28 and 50/52 ACE receipts with
  a pooled estimated 64.19% prompt reduction. This was not held-out quality proof.
- The failed live A/B retained 63 plans: 27 baseline and 36 treatment. The all-plan
  analyst calibration recovered 67/67 supported documentation claims at a
  180,000-character context cap. This does not establish semantic noninferiority.
- The fresh live quality result and 3–5× fewer tokens per accepted question remain
  unproven. Neither historical replay nor analyst calibration authorizes rollout.

See `../../PROCESS.md` for current defaults and the archived README/runbooks for
historical commands and evidence. Tests use synthetic data, not these outputs.
