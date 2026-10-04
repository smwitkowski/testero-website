-- Add 3-month pricing support for subscription_plans
-- This migration keeps legacy yearly columns for grandfathered subscriptions.

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS price_three_month INTEGER CHECK (price_three_month > 0),
ADD COLUMN IF NOT EXISTS stripe_price_id_three_month TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_id_three_month
  ON subscription_plans(stripe_price_id_three_month);

COMMENT ON COLUMN subscription_plans.price_three_month IS 'Price in cents for 3-month recurring subscription';
COMMENT ON COLUMN subscription_plans.stripe_price_id_three_month IS 'Stripe price ID for 3-month recurring subscription';
