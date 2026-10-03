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


-- Durable refund tombstones survive refund-before-fulfillment delivery.
CREATE TABLE public.pmle_pass_refunds (
    stripe_payment_intent_id TEXT PRIMARY KEY,
    refunded_at TIMESTAMPTZ NOT NULL CHECK (isfinite(refunded_at))
);
ALTER TABLE public.pmle_pass_refunds ENABLE ROW LEVEL SECURITY;
-- No user policies: refund state is accessible only to the service role.
REVOKE ALL ON TABLE public.pmle_pass_refunds FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pmle_pass_refunds TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pmle_passes TO service_role;

-- Both RPCs share a transaction-scoped lock on the payment intent. A refund
-- before insertion leaves a tombstone; a refund after insertion revokes the row.
CREATE FUNCTION public.fulfill_pmle_pass(
    p_user_id UUID,
    p_stripe_checkout_session_id TEXT,
    p_stripe_payment_intent_id TEXT,
    p_stripe_customer_id TEXT,
    p_paid_at TIMESTAMPTZ
)
RETURNS SETOF public.pmle_passes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pass public.pmle_passes%ROWTYPE;
    v_refunded_at TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF p_user_id IS NULL
       OR p_stripe_checkout_session_id IS NULL OR p_stripe_checkout_session_id = ''
       OR p_stripe_payment_intent_id IS NULL OR p_stripe_payment_intent_id = ''
       OR p_stripe_customer_id IS NULL OR p_stripe_customer_id = ''
       OR p_paid_at IS NULL OR NOT isfinite(p_paid_at) THEN
        RAISE EXCEPTION 'Invalid PMLE pass fulfillment arguments' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_stripe_payment_intent_id, 0)
    );
    -- Hours, not calendar days, guarantee 90 * 24h across DST transitions.
    v_expires_at := p_paid_at + INTERVAL '2160 hours';
    SELECT refunded_at INTO v_refunded_at
        FROM public.pmle_pass_refunds
        WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;

    INSERT INTO public.pmle_passes (
        user_id, stripe_checkout_session_id, stripe_payment_intent_id,
        stripe_customer_id, paid_at, expires_at, refunded_at
    ) VALUES (
        p_user_id, p_stripe_checkout_session_id, p_stripe_payment_intent_id,
        p_stripe_customer_id, p_paid_at, v_expires_at, v_refunded_at
    ) ON CONFLICT (stripe_checkout_session_id) DO NOTHING;
    -- A different checkout using the same intent fails its UNIQUE constraint.
    -- Never overwrite a duplicate checkout's owner, paid date, or expiry.
    SELECT * INTO v_pass FROM public.pmle_passes
        WHERE stripe_checkout_session_id = p_stripe_checkout_session_id;
    IF NOT FOUND
       OR v_pass.user_id IS DISTINCT FROM p_user_id
       OR v_pass.stripe_payment_intent_id IS DISTINCT FROM p_stripe_payment_intent_id
       OR v_pass.stripe_customer_id IS DISTINCT FROM p_stripe_customer_id
       OR v_pass.paid_at IS DISTINCT FROM p_paid_at
       OR v_pass.expires_at IS DISTINCT FROM v_expires_at THEN
        RAISE EXCEPTION 'PMLE pass identity or paid date mismatch' USING ERRCODE = '22023';
    END IF;

    IF v_refunded_at IS NOT NULL THEN
        UPDATE public.pmle_passes
            SET refunded_at = LEAST(COALESCE(refunded_at, v_refunded_at), v_refunded_at)
            WHERE id = v_pass.id
            RETURNING * INTO v_pass;
    END IF;
    RETURN NEXT v_pass;
END;
$$;

CREATE FUNCTION public.refund_pmle_pass(
    p_stripe_payment_intent_id TEXT,
    p_refunded_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_refunded_at TIMESTAMPTZ;
BEGIN
    IF p_stripe_payment_intent_id IS NULL OR p_stripe_payment_intent_id = ''
       OR p_refunded_at IS NULL OR NOT isfinite(p_refunded_at) THEN
        RAISE EXCEPTION 'Invalid PMLE pass refund arguments' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_stripe_payment_intent_id, 0)
    );
    INSERT INTO public.pmle_pass_refunds (stripe_payment_intent_id, refunded_at)
        VALUES (p_stripe_payment_intent_id, p_refunded_at)
        ON CONFLICT (stripe_payment_intent_id) DO UPDATE
        SET refunded_at = LEAST(public.pmle_pass_refunds.refunded_at, EXCLUDED.refunded_at)
        RETURNING refunded_at INTO v_refunded_at;
    UPDATE public.pmle_passes
        SET refunded_at = LEAST(COALESCE(refunded_at, v_refunded_at), v_refunded_at)
        WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;
END;
$$;

-- PostgreSQL grants PUBLIC execute by default: revoke it explicitly.
REVOKE EXECUTE ON FUNCTION public.fulfill_pmle_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_pmle_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
    TO service_role;
REVOKE EXECUTE ON FUNCTION public.refund_pmle_pass(TEXT, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_pmle_pass(TEXT, TIMESTAMPTZ)
    TO service_role;
