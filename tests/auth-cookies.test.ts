import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerSupabaseClient } from "@/lib/supabase/server";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), set: vi.fn(), getAll: vi.fn(), options: null as null | { cookieOptions: Record<string, unknown>; cookies: { getAll(): unknown; setAll(values: { name: string; value: string; options?: Record<string, unknown> }[]): void } } }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createClient }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: mocks.set, getAll: mocks.getAll })) }));
beforeEach(() => {
  mocks.options = null; mocks.set.mockReset(); mocks.getAll.mockReset().mockReturnValue([{ name: "testero_anon", value: "owner" }]);
  mocks.createClient.mockReset().mockImplementation((_url: string, _key: string, options: typeof mocks.options) => { mocks.options = options; return { auth: {} }; });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56541"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-mocked-key");
});
afterEach(() => vi.unstubAllEnvs());
describe("SSR-only protected auth cookies", () => {
  it("sets SDK defaults and forces HttpOnly with local compatible security", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await createServerSupabaseClient();
    expect(mocks.options?.cookieOptions).toEqual({ httpOnly: true, sameSite: "lax", secure: false, path: "/" });
    expect(mocks.options?.cookies.getAll()).toEqual([{ name: "testero_anon", value: "owner" }]);
    mocks.options!.cookies.setAll([{ name: "sb-local-auth-token", value: "opaque", options: { httpOnly: false, maxAge: 3600 } }]);
    expect(mocks.set).toHaveBeenCalledWith("sb-local-auth-token", "opaque", { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 3600 });
  });
  it("preserves SDK clearing options and never touches anonymous owner", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createServerSupabaseClient();
    mocks.options!.cookies.setAll([{ name: "sb-local-auth-token", value: "", options: { maxAge: 0 } }]);
    expect(mocks.set).toHaveBeenCalledWith("sb-local-auth-token", "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
    expect(mocks.set).toHaveBeenCalledOnce();
  });
  it("allows read-only component use when framework forbids cookie writes", async () => {
    mocks.set.mockImplementation(() => { throw new Error("read-only cookies"); });
    await createServerSupabaseClient();
    expect(() => mocks.options!.cookies.setAll([{ name: "sb-local-auth-token", value: "opaque" }])).not.toThrow();
  });
});
