# Frontier experiment protocol

Offline both PMLE b28 and ACE-b2;60 and52 proposed receipts respectively. All
nonempty original proofs pass full-source mechanical checks. Veto empty reasons
are outside quote denominator. Neither set is held-out after this selection.
Selection never receives proof text. Query variants plan/plan+objective/plan+objective
and quoted/capitalized product names use proposed plan only. Every mode includes
original first-chunk title/summary anchors for fetched pages when budget permits.
Top-k0 means all positive hits bounded by context budget. Neighbors=1 includes
one raw chunk either side before immutable-span merge. Sections=true sweeps
bounded6k source windows when multiple ranked hits land there: historic flattened
HTML has no reliable heading delimiters, so this is explicitly a local-window
surrogate, not a claim of recovered semantic HTML sections. Original hashes and
source spans remain exact. No models, network or DB writes.

Primary selection: among measured configurations satisfying >=95% on each set,
minimize total reconstructed verify prompt characters divided by total calls
(b28=69,ACE=22), not just maximum budget. Prompt token estimates chars/4,
including stable objective docs, retained candidate sources, instructions and plan.
Reduction is against full-source prompt reconstructed on same frozen scope.
Budget15/25/35/45k doc tokens =60000/100000/140000/180000 chars.
Initial base grid proposed all combinations800/1200/2200chunks,300/500overlap,
topk0/4/12.800-overlap500/allpositive became computationally expensive and was
interrupted; only completed rows are evidence. A bounded1200/2200 base grid and
explicit smaller-chunk neighbor tests cover remaining practical alternatives.
Additional explicit query/neighbor/window and refinement config JSON files are
checked in beside output JSONL. Interrupted sweeps can resume exact config+budget
rows; no result overwrites. Sweep worker memoization caches pure chunks/ranks from
immutable source tuples; quotes are used only after retrieval for scoring.
