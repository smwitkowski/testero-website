# PMLE Pass tier update (D-044)

## Production handoff: migrations first

The coordinator must apply these migrations before deploying this branch. This worker applied them only to the loopback local test database.

1. `supabase/migrations/20261024000000_unlimited_free_practice.sql`
2. `supabase/migrations/20261024100000_pmle_mock_exams.sql`

The coordinator must separately configure the $39.99 Stripe price and set `STRIPE_PRICE_PMLE_PASS`. This branch does not create or modify Stripe objects.

## Tier boundaries

- Free confirmed accounts can practice without a monthly cap. Right/wrong, the correct answer, per-domain progress and recent practice scores are free.
- Explanations remain server-authorized Pass content. The existing diagnostic preview and ChatGPT free set are unchanged.
- PMLE Pass adds 50-question, 120-minute mock exams, fresh-first selection, weak-area drills and variants. It remains one-time, 90 days, a 7-day refund window, and no auto-renew.
- Mock questions are originals. Variants remain Pass-only practice content and never inflate bank-size claims.

## Selection rules

- Pass selection reads all pages of owned answered diagnostic, practice and mock history. It prefers never-answered question IDs. Seen questions return only after the unseen pool runs out.
- Drills rank diagnostic and practice domain accuracy only after at least five distinct questions in a domain. With less history, they use the latest completed diagnostic focus. With no diagnostic, they start in a named general domain and explain the fallback.
- Mocks follow blueprint weights when inventory allows. An unseen inventory shortfall redistributes across domains before reusing seen questions. The altered mix is disclosed. A bank below 50 eligible originals repeats only after using every available question, with an explicit notice. An empty bank cannot produce a mock and returns an honest unavailable state.

## Timer and security

- Mock sessions and items are server-only tables with RLS and no browser grants. Public APIs verify confirmed identity, ownership and fresh paid access.
- The database owns the 120-minute deadline. Row locks serialize answer/submit operations, and the wall clock is checked after lock acquisition.
- The client submits when the timer reaches zero. If the browser is closed, the next authenticated interaction finalizes the expired attempt at its deadline. Late answers cannot change the score.
- Saved choices resume within the original time window. Answer keys and explanations never appear in an in-progress mock response. Unanswered items score incorrect.
- A refund denies new mock interactions and result retries; restored tabs discard and reload their sensitive result data.

## Price and claims

`lib/billing/pmle-pass.ts` is the single display/configured price source. Purchase revenue uses Stripe `amount_total / 100`, including discounted or zero totals, and only falls back to the configured price when absent or invalid.

Public volume copy uses the existing live active original-only inventory: “Unlimited practice from N questions, updated weekly.” If inventory is unavailable, no count is invented. Competitor prices remain unchanged.

## Verification

Final commands, results and screenshots are recorded in `verification.md` beside this file. No merge, deployment or production migration is authorized by this change.
