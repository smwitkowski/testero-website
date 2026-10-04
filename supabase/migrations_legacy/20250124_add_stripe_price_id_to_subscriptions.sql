-- Add stripe_price_id column to user_subscriptions table
-- This stores the active Stripe price ID from the subscription, populated by webhooks
-- This allows us to match against plan price IDs without brittle day-math calculations

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_price_id
  ON user_subscriptions(stripe_price_id);

COMMENT ON COLUMN user_subscriptions.stripe_price_id IS 'Active Stripe price ID for this subscription, populated by webhooks. Used to match against plan price IDs for billing display.';
