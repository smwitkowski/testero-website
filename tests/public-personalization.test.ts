import { beforeEach, expect, it, vi } from "vitest";
import { GET as navigation } from "@/app/api/auth/navigation/route";
import { GET as access } from "@/app/api/billing/access/route";
const mocks = vi.hoisted(() => ({ navigation: vi.fn(), user: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/auth/navigation", () => ({ verifiedNavigationUserId: mocks.navigation }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: mocks.user }));
vi.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: mocks.access }));
beforeEach(() => { vi.resetAllMocks(); mocks.navigation.mockResolvedValue(null); mocks.user.mockResolvedValue(null); });
it.each([null, "verified-user"])("returns privately verified navigation state %s", async userId => {
  mocks.navigation.mockResolvedValue(userId);
  const response = await navigation();
  expect(await response.json()).toEqual({ userId });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("does not query billing for anonymous navigation", async () => {
  const response = await access();
  expect(await response.json()).toEqual({ signedIn: false });
  expect(mocks.access).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it.each([
  { hasPaidAccess: false, isLegacySubscriber: false, pass: null },
  { hasPaidAccess: true, isLegacySubscriber: true, pass: null },
  { hasPaidAccess: true, isLegacySubscriber: false, pass: { expires_at: "2027-01-01T00:00:00Z" } },
])("returns display-only pass state freshly for a verified account %#", async paid => {
  mocks.user.mockResolvedValue({ id: "verified" }); mocks.access.mockResolvedValue(paid);
  const response = await access();
  expect(mocks.access).toHaveBeenCalledWith("verified");
  expect(await response.json()).toEqual({ signedIn: true, owned: paid.hasPaidAccess, expiresAt: paid.pass?.expires_at ?? null });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("fails closed and no-store when access is unavailable", async () => {
  mocks.user.mockResolvedValue({ id: "verified" }); mocks.access.mockResolvedValue({ unavailable: true });
  const response = await access();
  expect(response.status).toBe(503);
  expect(await response.json()).not.toHaveProperty("owned");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
