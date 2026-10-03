import * as compatibility from "@/lib/billing/is-subscriber";
import * as authoritative from "@/lib/billing/paid-access";

jest.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: jest.fn() }));

describe("paid access compatibility exports", () => {
  it("re-exports the authoritative implementation, not a separate rule", () => {
    expect(compatibility.getPaidAccess).toBe(authoritative.getPaidAccess);
    expect(compatibility.isSubscriber).toBe(authoritative.isSubscriber);
  });
  it("keeps cache invalidation calls safe while access is uncached", () => {
    expect(() => compatibility.clearSubscriberCache("user-1")).not.toThrow();
    expect(() => compatibility.clearAllSubscriberCache()).not.toThrow();
  });
});
