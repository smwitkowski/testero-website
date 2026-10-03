# Testero Revenue Model & Pricing Strategy

Last updated: 2026-10-02

## Current offer

**PMLE Pass** is the only offer for new purchases:

- US$39, paid once.
- 90 days of full PMLE access, starting at confirmed payment.
- No subscription and no automatic renewal.
- Request a refund within 7 days of purchase. A refund ends pass access.
- No trials, hidden tiers, duration packages, or recurring offers.

The offer fits an exam preparation cycle. It does not charge learners after their access expires.

## Free entry and paid access

Free entry:

- Start a PMLE diagnostic without an account.
- View the basic readiness summary without an account.
- Create a free account for question review and saved results.
- Registered free users get limited practice: 5 questions per week.
- No explanations or domain-targeted practice for free users.

PMLE Pass includes:

- Full PMLE question bank and unlimited PMLE practice.
- Detailed answer explanations.
- Domain-targeted practice and readiness insights.
- Progress tracking.

Do not claim a one-free-diagnostic limit or paid-only diagnostic retakes. These are not enforced boundaries. Keep the copy aligned with the server access rules.

## Existing subscriptions

Active legacy subscriptions keep their access. Do not cancel, replace, or change their billing when launching PMLE Pass. Only accounts with an existing legacy subscription can open the subscription management portal. The portal is not a PMLE Pass cancellation or refund tool.

## Positioning and copy

Use **PMLE Pass** in UI and analytics. State US$39 once, 90-day access, no renewal, and the 7-day refund window. Place the refund access consequence beside refund claims.

Sell readiness clarity, explanations that teach, and practice focused on weak domains. Do not promise passing the exam, official Google affiliation, or unsupported pass-rate and accuracy numbers.

The free diagnostic proves value before purchase. It is not a payment trial.

## Checkout and access

- The browser never chooses or receives a Stripe price ID.
- Checkout accepts an optional idempotency key. The server selects the configured PMLE Pass price.
- Confirmed paid checkout creates the pass. A success redirect alone does not grant access.
- Pass expiry and refund revocation are checked by the server.
- Analytics use `plan_name: "PMLE Pass"`, `payment_mode: "payment"`, and `plan_type: "pass"`. Do not record new monthly intervals or tier names.

See `docs/deployment/stripe-setup.md` for founder setup and test-mode verification. The launch remains subject to verified question quality and access boundaries.

## Measurement

Track the funnel from diagnostic completion to signup, practice, explanation gates, checkout, and confirmed payment. Track refunds and pass expirations separately from subscription cancellations.

Measure explanation views, practice sessions, readiness changes, support requests, and operating cost per paying learner. Evaluate the current single offer before testing different prices. Do not silently introduce packages or subscriptions.
