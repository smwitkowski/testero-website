/** @jest-environment node */
import { readFileSync } from "fs";
import { join } from "path";

// Static contract checks only. No database apply or external service calls.
const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261003_create_pmle_passes.sql"),
  "utf8"
);
const fulfill = sql.slice(
  sql.indexOf("CREATE FUNCTION public.fulfill_pmle_pass("),
  sql.indexOf("CREATE FUNCTION public.refund_pmle_pass(")
);
const refund = sql.slice(
  sql.indexOf("CREATE FUNCTION public.refund_pmle_pass("),
  sql.indexOf("-- PostgreSQL grants PUBLIC execute")
);

describe("unapplied PMLE Pass SQL security and RPC contract", () => {
  it("uses unique checkout/payment IDs and preserves expiry validity", () => {
    expect(sql).toMatch(/stripe_checkout_session_id TEXT NOT NULL UNIQUE/);
    expect(sql).toMatch(/stripe_payment_intent_id TEXT NOT NULL UNIQUE/);
    expect(sql).toMatch(/user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(sql).toContain("CHECK (expires_at > paid_at)");
    expect(sql).not.toContain("verified_at");
  });
  it("enables RLS on passes with only own-user SELECT", () => {
    expect(sql).toContain("ALTER TABLE public.pmle_passes ENABLE ROW LEVEL SECURITY");
    const policies = sql.match(/CREATE POLICY[\s\S]*?;/g) ?? [];
    expect(policies).toHaveLength(1);
    expect(policies[0]).toContain("ON public.pmle_passes FOR SELECT");
    expect(policies[0]).toContain("USING (auth.uid() = user_id)");
  });
  it("stores durable unique refund tombstones with no user access or policies", () => {
    expect(sql).toContain("stripe_payment_intent_id TEXT PRIMARY KEY");
    expect(sql).toContain("refunded_at TIMESTAMPTZ NOT NULL CHECK (isfinite(refunded_at))");
    expect(sql).toContain("ALTER TABLE public.pmle_pass_refunds ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.pmle_pass_refunds FROM PUBLIC, anon, authenticated"
    );
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE ON TABLE public.pmle_pass_refunds TO service_role"
    );
  });
  it.each([fulfill, refund])(
    "serializes fulfillment and refund with the same transaction-scoped intent lock",
    (fn) => {
      expect(fn).toContain("pg_catalog.pg_advisory_xact_lock(");
      expect(fn).toContain("pg_catalog.hashtextextended(p_stripe_payment_intent_id, 0)");
      expect(fn).toContain("SECURITY INVOKER");
      expect(fn).toContain("SET search_path = public, pg_temp");
      expect(fn.indexOf("pg_catalog.pg_advisory_xact_lock")).toBeLessThan(
        fn.indexOf("INSERT INTO")
      );
    }
  );
  it("fulfills an immutable one-row contract with exactly 90 * 24h expiry", () => {
    expect(fulfill).toMatch(
      /p_user_id UUID,[\s\S]*p_stripe_checkout_session_id TEXT,[\s\S]*p_stripe_payment_intent_id TEXT,[\s\S]*p_stripe_customer_id TEXT,[\s\S]*p_paid_at TIMESTAMPTZ/
    );
    expect(fulfill).toContain("RETURNS SETOF public.pmle_passes");
    expect(fulfill).toContain("INTERVAL '2160 hours'");
    expect(fulfill).toContain("ON CONFLICT (stripe_checkout_session_id) DO NOTHING");
    expect(fulfill).not.toMatch(/ON CONFLICT[\s\S]*DO UPDATE/);
    expect(fulfill).toContain("RETURN NEXT v_pass");
    for (const field of [
      "user_id",
      "stripe_payment_intent_id",
      "stripe_customer_id",
      "paid_at",
      "expires_at",
    ])
      expect(fulfill).toContain(`v_pass.${field} IS DISTINCT FROM`);
    expect(fulfill).toContain("p_paid_at IS NULL OR NOT isfinite(p_paid_at)");
  });
  it("consults the durable refund before inserting and never clears refund or changes dates", () => {
    expect(fulfill.indexOf("FROM public.pmle_pass_refunds")).toBeLessThan(
      fulfill.indexOf("INSERT INTO public.pmle_passes")
    );
    expect(fulfill).toContain("p_stripe_customer_id, p_paid_at, v_expires_at, v_refunded_at");
    const update = fulfill.slice(fulfill.indexOf("UPDATE public.pmle_passes"));
    expect(update).toContain(
      "SET refunded_at = LEAST(COALESCE(refunded_at, v_refunded_at), v_refunded_at)"
    );
    expect(update).not.toMatch(/SET[\s\S]*(paid_at|expires_at|user_id)\s*=/);
    expect(fulfill).not.toMatch(/refunded_at\s*=\s*NULL/i);
  });
  it("keeps the earliest refund even when no pass row exists", () => {
    expect(refund).toContain("RETURNS VOID");
    expect(refund).toContain("ON CONFLICT (stripe_payment_intent_id) DO UPDATE");
    expect(refund).toContain("LEAST(public.pmle_pass_refunds.refunded_at, EXCLUDED.refunded_at)");
    expect(refund.indexOf("INSERT INTO public.pmle_pass_refunds")).toBeLessThan(
      refund.indexOf("UPDATE public.pmle_passes")
    );
    expect(refund).toContain("WHERE stripe_payment_intent_id = p_stripe_payment_intent_id");
    expect(refund).toContain("p_refunded_at IS NULL OR NOT isfinite(p_refunded_at)");
  });
  it.each([
    "fulfill_pmle_pass(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)",
    "refund_pmle_pass(TEXT, TIMESTAMPTZ)",
  ])("restricts %s execution to service_role", (signature) => {
    expect(sql).toContain(
      `REVOKE EXECUTE ON FUNCTION public.${signature}\n    FROM PUBLIC, anon, authenticated`
    );
    expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature}\n    TO service_role`);
  });
});
