import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/billing/status/route";
import { getVerifiedUser } from "@/lib/auth/session";
const m = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => m }));
function req(query = "session_id=cs_test_owned") { return new Request(`http://localhost:3000/api/billing/status?${query}`); }
beforeEach(() => { vi.mocked(getVerifiedUser).mockResolvedValue({ id: "user", email_confirmed_at: "confirmed" } as never); m.from.mockReturnValue(m); m.select.mockReturnValue(m); m.eq.mockReturnValue(m); m.maybeSingle.mockResolvedValue({ data: null, error: null }); });
describe("owned read-only checkout status", () => {
  it("requires auth before parsing untrusted session id", async () => { vi.mocked(getVerifiedUser).mockResolvedValue(null); const r = await GET(req("")); expect(r.status).toBe(401); expect(m.from).not.toHaveBeenCalled(); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
  it.each(["", "session_id=bad", "session_id=cs_a&session_id=cs_b", "session_id=cs_%3Cscript%3E", `session_id=cs_${"a".repeat(241)}`])("rejects missing, ambiguous, or malformed id %s", async query => { expect((await GET(req(query))).status).toBe(400); expect(m.from).not.toHaveBeenCalled(); });
  it("returns processing for unknown or not-owned without any Stripe call/grant", async () => { const r = await GET(req()); expect(await r.json()).toEqual({ status: "processing", accessUntil: null }); expect(m.from).toHaveBeenCalledExactlyOnceWith("pmle_passes"); expect(m.select).toHaveBeenCalledWith("expires_at, refunded_at"); expect(m.eq).toHaveBeenCalledWith("user_id", "user"); expect(m.eq).toHaveBeenCalledWith("stripe_checkout_session_id", "cs_test_owned"); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
  it.each([ ["active", "2099-01-01T00:00:00Z", null], ["expired", "2020-01-01T00:00:00Z", null], ["refunded", "2099-01-01T00:00:00Z", "2026-01-01T00:00:00Z"] ])("reports %s from durable owned pass row", async (status, expires_at, refunded_at) => { m.maybeSingle.mockResolvedValue({ data: { expires_at, refunded_at }, error: null }); expect(await (await GET(req())).json()).toEqual({ status, accessUntil: expires_at }); });
  it.each([{ data: null, error: { message: "private DB" } }, { data: { expires_at: "broken", refunded_at: null }, error: null }])("returns 503 instead of false processing on DB failure %#", async result => { vi.spyOn(console, "error").mockImplementation(() => {}); m.maybeSingle.mockResolvedValue(result); const r = await GET(req()); expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("private DB"); expect(r.headers.get("cache-control")).toBe("private, no-store"); });
});
