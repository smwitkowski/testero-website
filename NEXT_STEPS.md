# Next Steps — 2-Week Mobile UX Plan

## Week 1: Ship Quick Wins
1. **Deploy audited fixes** (viewport, hero clamp, nav CTA, focus ring, form labels, avatar sizing) — already implemented in this PR; monitor metrics post-release.
2. **Ticket F2** — Remove or gate `autoFocus` on waitlist/auth forms to avoid forced keyboards on mobile landing pages (coordination with marketing stakeholders).
3. **Ticket P1** — Add the missing `pricing-cards` anchor id so comparison-table scroll links function on mobile and desktop.

## Week 2: Systemize & Extend
1. **Ticket T1** — Extend clamp-based typography to remaining marketing headings/subheads to standardize density across sections.
2. **Ticket A1** — Establish global focus-visible utility for anchor buttons (nav links, accordions, toggles) to align with updated button focus rings.
3. **Ticket N1** — Audit navbar shadow/contrast on dark hero backgrounds; adjust tokens as needed for 3:1 contrast ratio.
4. **Ticket I1** — Plan remote avatar domain whitelisting and migration to `next/image` to finish CLS hardening.

## Dependencies & Notes
- Coordinate with design for typography token updates (Tickets T1, N1).
- Updating `next.config.mjs` for remote images requires deployment pipeline awareness (Ticket I1).
- QA should include mobile regression runs on key breakpoints (320px, 375px, 428px, 768px) after each batch.
