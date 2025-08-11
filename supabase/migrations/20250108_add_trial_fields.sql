-- Add trial-related fields to user_subscriptions table
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- Add index for finding trials that are ending soon
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_ends_at 
ON user_subscriptions(trial_ends_at) 
WHERE trial_ends_at IS NOT NULL;

-- Add index for finding active trials
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trialing 
ON user_subscriptions(status) 
WHERE status = 'trialing';