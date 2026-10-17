-- Both fulfillment callers share one best-effort analytics claim.
ALTER TABLE public.pmle_passes ADD COLUMN purchase_completed_at TIMESTAMPTZ;
