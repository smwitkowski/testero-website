-- Add composite indexes for improved query performance on user_subscriptions table

-- Index for common query pattern: finding active subscriptions for a user
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status 
ON user_subscriptions(user_id, status)
WHERE status IN ('active', 'trialing');

-- Index for subscription lookup by Stripe subscription ID (frequently used in webhooks)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_sub_id 
ON user_subscriptions(stripe_subscription_id);

-- Index for finding subscriptions ending soon (for renewal reminders)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_current_period_end 
ON user_subscriptions(current_period_end)
WHERE status = 'active';

-- Index for payments lookup by user and status
CREATE INDEX IF NOT EXISTS idx_payments_user_status 
ON payments(user_id, status);

-- Index for finding recent payments (for billing history)
CREATE INDEX IF NOT EXISTS idx_payments_created_at 
ON payments(created_at DESC);