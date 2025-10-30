This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src/dashboard/**, src/pages/login.tsx, src/pages/diagnostic.tsx, src/pages/practice-test.tsx, src/pages/api/**, src/db/**, src/components/**, src/utils/**, prisma/**, supabase/**
- Files matching patterns in .gitignore are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
supabase/
  migrations/
    20250106_create_billing_tables.sql
    20250107_add_billing_indexes.sql
    20250108_add_trial_fields.sql
  config.toml
```

# Files

## File: supabase/migrations/20250107_add_billing_indexes.sql
```sql
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
```

## File: supabase/migrations/20250108_add_trial_fields.sql
```sql
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
```

## File: supabase/config.toml
```toml
# A string used to distinguish different Supabase projects on the same host. Defaults to the working
# directory name when running `supabase init`.
project_id = "testero"

[api]
# Port to use for the API URL.
port = 54321
# Schemas to expose in your API. Tables, views and stored procedures in this schema will get API
# endpoints. public and storage are always included.
schemas = ["public", "storage", "graphql_public"]
# Extra schemas to add to the search_path of every request. public is always included.
extra_search_path = ["public", "extensions"]
# The maximum number of rows returns from a view, table, or stored procedure. Limits payload size
# for accidental or malicious requests.
max_rows = 1000

[db]
# Port to use for the local database URL.
port = 54322
# The database major version to use. This has to be the same as your remote database's. Run `SHOW
# server_version;` on the remote database to check.
major_version = 15

[studio]
# Port to use for Supabase Studio.
port = 54323

# Email testing server. Emails sent with the local dev setup are not actually sent - rather, they
# are monitored, and you can view the emails that would have been sent from the web interface.
[inbucket]
# Port to use for the email testing server web interface.
port = 54324

[storage]
# The maximum file size allowed (e.g. "5MB", "500KB").
file_size_limit = "50MiB"

[auth]
# The base URL of your website. Used as an allow-list for redirects and for constructing URLs used
# in emails.
site_url = "http://localhost:3000"
# A list of *exact* URLs that auth providers are permitted to redirect to post authentication.
additional_redirect_urls = ["https://localhost:3000"]
# How long tokens are valid for, in seconds. Defaults to 3600 (1 hour), maximum 604,800 seconds (one
# week).
jwt_expiry = 3600
# Allow/disallow new user signups to your project.
enable_signup = true

[auth.email]
# Allow/disallow new user signups via email to your project.
enable_signup = true
# If enabled, a user will be required to confirm any email change on both the old, and new email
# addresses. If disabled, only the new email is required to confirm.
double_confirm_changes = true
# If enabled, users need to confirm their email address before signing in.
enable_confirmations = true

[analytics]
enabled = false
port = 54327
vector_port = 54328
# Setup BigQuery project to enable log viewer on local development stack.
# See: https://logflare.app/guides/bigquery-setup
gcp_project_id = ""
gcp_project_number = ""
gcp_jwt_path = "supabase/gcloud.json"
```

## File: supabase/migrations/20250106_create_billing_tables.sql
```sql
-- Enable UUID generation extension (required for uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price_monthly INTEGER NOT NULL CHECK (price_monthly > 0),
    price_yearly INTEGER NOT NULL CHECK (price_yearly > 0),
    stripe_price_id_monthly TEXT UNIQUE,
    stripe_price_id_yearly TEXT UNIQUE,
    features JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    stripe_subscription_id TEXT UNIQUE,
    plan_id UUID REFERENCES subscription_plans(id),
    status TEXT NOT NULL CHECK (
        status IN (
            'trialing',
            'active',
            'past_due',
            'canceled',
            'unpaid',
            'incomplete',
            'incomplete_expired'
        )
    ),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment_history table
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT UNIQUE,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    processed BOOLEAN DEFAULT false,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON payment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- Add RLS policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Subscription plans are publicly readable
CREATE POLICY "Subscription plans are viewable by everyone" 
    ON subscription_plans FOR SELECT 
    USING (true);

-- Users can only view their own subscriptions
CREATE POLICY "Users can view own subscriptions" 
    ON user_subscriptions FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can only view their own payment history
CREATE POLICY "Users can view own payment history" 
    ON payment_history FOR SELECT 
    USING (auth.uid() = user_id);

-- Webhook events are only accessible via service role
-- No RLS policies for webhook_events - only service role can access

-- Add update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at 
    BEFORE UPDATE ON subscription_plans 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at 
    BEFORE UPDATE ON user_subscriptions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```
