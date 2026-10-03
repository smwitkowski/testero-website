import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasVerifiedNavigationSession } from "@/lib/auth/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const mocks = vi.hoisted(() => ({
  cookies: [] as { name: string; value: string }[],
  getUser: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ getAll: () => mocks.cookies })) }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));

beforeEach(() => {
  mocks.cookies = [];
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "verified-user", email_confirmed_at: "2026-10-03T12:00:00Z" } }, error: null });
  vi.mocked(createServerSupabaseClient).mockReset().mockResolvedValue({ auth: { getUser: mocks.getUser } } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56541");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-test-key-not-a-real-credential");
});
afterEach(() => vi.unstubAllEnvs());

describe("verified account state for navigation", () => {
  it.each([
    [], [{ name: "testero_anon", value: "a".repeat(64) }],
    [{ name: "unrelated", value: "cookie" }],
    [{ name: "sb-project-other-token", value: "fake" }],
    [{ name: "foreign-auth-token", value: "fake" }],
  ].map((cookies) => ({ cookies })))("anonymous/non-auth cookies do not create a client %#", async ({ cookies }) => {
    mocks.cookies = cookies;
    expect(await hasVerifiedNavigationSession()).toBe(false);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it.each([
    { url: "", key: "local-test-key" },
    { url: undefined, key: "local-test-key" },
    { url: "http://127.0.0.1:56541", key: "" },
    { url: "http://127.0.0.1:56541", key: undefined },
    { url: "http://127.0.0.1:56541", key: "placeholder-build-anon-key" },
    { url: "http://127.0.0.1:56541", key: "local-anon-key-placeholder" },
  ])("missing/placeholder config skips auth even with an auth cookie: $key", async ({ url, key }) => {
    mocks.cookies = [{ name: "sb-local-auth-token", value: "fake-cookie" }];
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
    expect(await hasVerifiedNavigationSession()).toBe(false);
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it.each(["sb-local-auth-token", "sb-local-auth-token.0", "sb-local-auth-token.1"])
    ("accepts a verified user with configured local auth cookie %s", async (name) => {
      mocks.cookies = [{ name, value: "opaque-cookie" }];
      expect(await hasVerifiedNavigationSession()).toBe(true);
      expect(createServerSupabaseClient).toHaveBeenCalledOnce();
      expect(mocks.getUser).toHaveBeenCalledOnce();
    });

  it("does not trust the auth cookie when server verification returns no user", async () => {
    mocks.cookies = [{ name: "sb-local-auth-token", value: "fake-cookie" }];
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await hasVerifiedNavigationSession()).toBe(false);
  });

  it("denies a verification error even if a user object is present", async () => {
    mocks.cookies = [{ name: "sb-local-auth-token", value: "fake-cookie" }];
    mocks.getUser.mockResolvedValue({ data: { user: { id: "unverified-user" } }, error: { message: "verification failed" } });
    expect(await hasVerifiedNavigationSession()).toBe(false);
  });

  it("does not advertise protected navigation to an unconfirmed account", async () => {
    mocks.cookies = [{ name: "sb-local-auth-token", value: "opaque-cookie" }];
    mocks.getUser.mockResolvedValue({ data: { user: { id: "unconfirmed-user", email_confirmed_at: null } }, error: null });
    expect(await hasVerifiedNavigationSession()).toBe(false);
  });

  it("returns signed-out on thrown auth failure", async () => {
    mocks.cookies = [{ name: "sb-local-auth-token", value: "fake-cookie" }];
    mocks.getUser.mockRejectedValue(new Error("local auth unavailable"));
    expect(await hasVerifiedNavigationSession()).toBe(false);
  });

  it("returns signed-out if client creation throws", async () => {
    mocks.cookies = [{ name: "sb-local-auth-token", value: "fake-cookie" }];
    vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error("configuration unavailable"));
    expect(await hasVerifiedNavigationSession()).toBe(false);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
