# Stripe price configuration

New purchases use one server-only variable: `STRIPE_PRICE_PMLE_PASS`.

Set it to the Stripe **one-time USD $39.00 price** for the product named **PMLE Pass**. Use the test-mode price with test keys and the live-mode price with live keys. Do not configure browser price IDs or new recurring tiers/packages.

The price ID is not checked into this document. See [PMLE Pass: Stripe setup](./stripe-setup.md) for founder setup, webhook events, migration, and manual QA.

Legacy subscription price IDs remain in existing database records only so current subscribers and their billing events continue to work. They are not offered in checkout.
