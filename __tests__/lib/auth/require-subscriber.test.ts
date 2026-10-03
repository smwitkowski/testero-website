/** @jest-environment node */
import type { User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requireSubscriber } from "@/lib/auth/require-subscriber";
import { getPmleAccessLevelForRequest } from "@/lib/access/pmleEntitlements.server";
jest.mock("@/lib/access/pmleEntitlements.server", () => ({ getPmleAccessLevelForRequest: jest.fn() }));
const access = jest.mocked(getPmleAccessLevelForRequest);
beforeEach(() => jest.clearAllMocks());
it.each(["ANONYMOUS", "FREE"] as const)("blocks %s even with a checkout cookie", async (accessLevel) => {
  access.mockResolvedValue({ accessLevel, user: accessLevel === "FREE" ? { id: "user" } as User : null });
  const req = new NextRequest("http://localhost/api/questions/current", { headers: { cookie: "checkout_grace=signed-cookie" } });
  const res = await requireSubscriber(req, "/api/questions/current");
  expect(res?.status).toBe(403);
  expect(await res?.json()).toEqual({ code: "PAYWALL" });
});
it("allows authenticated durable paid access", async () => {
  access.mockResolvedValue({ accessLevel: "SUBSCRIBER", user: { id: "paid" } as User });
  expect(await requireSubscriber(new Request("http://localhost"), "practice")).toBeNull();
});
it("requires authentication even if a helper erroneously reports paid access", async () => {
  access.mockResolvedValue({ accessLevel: "SUBSCRIBER", user: null });
  expect((await requireSubscriber(new Request("http://localhost"), "practice"))?.status).toBe(403);
});
it("fails closed on entitlement lookup errors", async () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  access.mockRejectedValue(new Error("lookup failed"));
  expect((await requireSubscriber(new Request("http://localhost"), "practice"))?.status).toBe(403);
  spy.mockRestore();
});
