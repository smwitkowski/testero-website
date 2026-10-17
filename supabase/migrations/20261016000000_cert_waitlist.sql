-- Launch notifications only. Browser roles cannot read or write email addresses.
CREATE TABLE public.cert_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(trim(email)) AND length(email) BETWEEN 3 AND 254),
  cert_id text NOT NULL,
  source_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, cert_id)
);
ALTER TABLE public.cert_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cert_waitlist FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cert_waitlist TO service_role;
