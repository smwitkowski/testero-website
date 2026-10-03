import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPaidAccess, type PmlePass } from "@/lib/billing/paid-access";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn() }));
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = Date.parse("2026-10-03T12:00:00Z");
const pass: PmlePass = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", paid_at: "2026-10-01T12:00:00Z", expires_at: "2026-12-30T12:00:00Z", refunded_at: null };
const free = { hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null };
function database(legacy: unknown = null, passes: unknown = [], errorTable?: string, throwTable?: string) {
  const from = vi.fn((table: string) => {
    if (table === throwTable) throw new Error("private SDK error");
    const result = () => ({ data: table === "user_subscriptions" ? legacy : passes, error: table === errorTable ? { message: "private SDK error" } : null });
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), limit: vi.fn(() => query), order: vi.fn(() => query), maybeSingle: vi.fn(async () => result()), then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve) };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, from };
}
beforeEach(() => { vi.mocked(createServiceSupabaseClient).mockReset(); });
describe("fresh fail-closed paid access", () => {
  it("defaults to a server-only service client", async () => {
    const db = database(null, [pass]); vi.mocked(createServiceSupabaseClient).mockReturnValue(db.client);
    expect((await getPaidAccess(userId, undefined, now)).pass).toEqual(pass);
    expect(createServiceSupabaseClient).toHaveBeenCalledOnce();
  });
  it("returns safe free metadata for no purchases", async () => { expect(await getPaidAccess(userId, database().client, now)).toEqual(free); });
  it("whitelists pass data and preserves active legacy access", async () => {
    const access = await getPaidAccess(userId, database({ status: "active", current_period_end: null }, [{ ...pass, stripe_customer_id: "secret" }]).client, now);
    expect(access).toEqual({ hasPaidAccess: true, isLegacySubscriber: true, accessUntil: pass.expires_at, pass });
  });
  it("legacy active is sufficient even after its display period", async () => {
    expect(await getPaidAccess(userId, database({ status: "active", current_period_end: "2025-01-01T00:00:00Z" }).client, now)).toEqual({ ...free, hasPaidAccess: true, isLegacySubscriber: true, accessUntil: "2025-01-01T00:00:00Z" });
  });
  it.each([{ expires_at: "2026-10-03T12:00:00Z" }, { expires_at: "2026-10-03T11:59:59Z" }, { refunded_at: "2026-10-02T12:00:00Z" }, { paid_at: "2026-10-04T00:00:00Z" }])("rejects expired/refunded/future pass %#", async override => {
    expect(await getPaidAccess(userId, database(null, [{ ...pass, ...override }]).client, now)).toEqual(free);
  });
  it("newer refunds cannot hide another valid pass", async () => {
    expect((await getPaidAccess(userId, database(null, [{ ...pass, expires_at: "2027-01-01T00:00:00Z", refunded_at: "2026-10-03T00:00:00Z" }, pass]).client, now)).pass).toEqual(pass);
  });
  it.each(["pmle_passes", "user_subscriptions"])("ANY query error removes both sources: %s", async table => {
    expect(await getPaidAccess(userId, database({ status: "active", current_period_end: null }, [pass], table).client, now)).toEqual({ ...free, unavailable: true });
  });
  it.each(["pmle_passes", "user_subscriptions"])("ANY thrown error removes both sources: %s", async table => {
    expect(await getPaidAccess(userId, database({ status: "active", current_period_end: null }, [pass], undefined, table).client, now)).toEqual({ ...free, unavailable: true });
  });
  it.each([null, {}, [{ ...pass, id: "bad" }], [{ ...pass, expires_at: "bad" }], [{ ...pass, expires_at: "2027-02-30T12:00:00Z" }], [{ ...pass, expires_at: "2027-01-01T24:00:00Z" }], [{ ...pass, paid_at: "bad" }], [{ ...pass, refunded_at: "bad" }], [{ ...pass, refunded_at: undefined }], [{ ...pass, paid_at: pass.expires_at }]])("malformed pass source redacts even verified legacy %#", async passes => {
    expect(await getPaidAccess(userId, database({ status: "active", current_period_end: null }, passes).client, now)).toEqual({ ...free, unavailable: true });
  });
  it.each([{}, { status: "active", current_period_end: "bad" }, { status: "active" }, { status: "inactive", current_period_end: null }])("malformed legacy source redacts even valid pass %#", async legacy => {
    expect(await getPaidAccess(userId, database(legacy, [pass]).client, now)).toEqual({ ...free, unavailable: true });
  });
  it("reads again each time, including immediate refunds and exact expiry", async () => {
    const passes = [pass]; const db = database(null, passes);
    expect((await getPaidAccess(userId, db.client, now)).hasPaidAccess).toBe(true);
    passes[0] = { ...pass, refunded_at: "2026-10-03T12:00:00Z" };
    expect((await getPaidAccess(userId, db.client, now)).hasPaidAccess).toBe(false);
    passes[0] = pass;
    expect((await getPaidAccess(userId, db.client, Date.parse(pass.expires_at))).hasPaidAccess).toBe(false);
    expect(db.from).toHaveBeenCalledTimes(6);
  });
  it("client creation failure and invalid identity fail closed", async () => {
    vi.mocked(createServiceSupabaseClient).mockImplementation(() => { throw new Error("secret"); });
    expect(await getPaidAccess(userId)).toEqual({ ...free, unavailable: true });
    const db = database(); expect(await getPaidAccess("bad", db.client, now)).toEqual({ ...free, unavailable: true }); expect(db.from).not.toHaveBeenCalled();
  });
});
