-- One-time PMLE Pass purchases. Apply through the normal migration process only.
CREATE TABLE public.pmle_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_checkout_session_id TEXT NOT NULL UNIQUE,
    stripe_payment_intent_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pmle_pass_expiry_after_payment CHECK (expires_at > paid_at)
);

CREATE INDEX idx_pmle_passes_user_expiry ON public.pmle_passes (user_id, expires_at DESC);

ALTER TABLE public.pmle_passes ENABLE ROW LEVEL SECURITY;

-- Match billing RLS: users may read their own rows, only service role may write.
CREATE POLICY "Users can view own PMLE passes"
    ON public.pmle_passes FOR SELECT
    USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies. Checkout and refund webhooks use service role.
