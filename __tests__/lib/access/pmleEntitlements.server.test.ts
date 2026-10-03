/** @jest-environment node */
import { getPmleAccessLevelForRequest } from "@/lib/access/pmleEntitlements.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSubscriber } from "@/lib/billing/paid-access";

jest.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: jest.fn() }));
jest.mock("@/lib/billing/paid-access", () => ({ isSubscriber: jest.fn() }));

describe("server access level", () => {
  let getUser: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    getUser = jest
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1", is_anonymous: false } }, error: null });
    (createServerSupabaseClient as jest.Mock).mockReturnValue({ auth: { getUser } });
    (isSubscriber as jest.Mock).mockResolvedValue(false);
  });
  it("uses authoritative paid access for a paid user", async () => {
    (isSubscriber as jest.Mock).mockResolvedValue(true);
    expect((await getPmleAccessLevelForRequest()).accessLevel).toBe("SUBSCRIBER");
    expect(isSubscriber).toHaveBeenCalledWith("user-1");
  });
  it("returns the free level when there is no paid access", async () => {
    expect((await getPmleAccessLevelForRequest()).accessLevel).toBe("FREE");
  });
  it("fails closed on auth errors even when a user object is returned", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: new Error("auth") });
    expect(await getPmleAccessLevelForRequest()).toEqual({ accessLevel: "ANONYMOUS", user: null });
    expect(isSubscriber).not.toHaveBeenCalled();
  });
  it("fails closed when auth throws", async () => {
    getUser.mockRejectedValue(new Error("auth"));
    expect(await getPmleAccessLevelForRequest()).toEqual({ accessLevel: "ANONYMOUS", user: null });
  });
});
