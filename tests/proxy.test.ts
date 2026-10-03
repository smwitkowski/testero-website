import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(values: { name: string; value: string; options?: {
    httpOnly?: boolean; secure?: boolean; sameSite?: "lax"; path?: string; maxAge?: number;
  } }[]): void;
}
const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), getUser: vi.fn(), getSession: vi.fn(),
  adapter: null as CookieAdapter | null,
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createClient }));

function request() {
  return new NextRequest("http://127.0.0.1:3000/diagnostic", {
    headers: { Cookie: "sb-local-auth-token.0=stale-token; testero_anon=opaque-owner" },
  });
}
beforeEach(() => {
  mocks.adapter = null;
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
  mocks.getSession.mockReset();
  mocks.createClient.mockReset().mockImplementation((_url: string, _key: string, options: { cookies: CookieAdapter }) => {
    mocks.adapter = options.cookies;
    return { auth: { getUser: mocks.getUser, getSession: mocks.getSession } };
  });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56541");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-test-key-not-a-real-credential");
});
afterEach(() => vi.unstubAllEnvs());

describe("Supabase proxy preview guard and verified refresh", () => {
  it("skips the SDK when either public config value is missing, even with stale auth cookies", async () => {
    for (const [url, key] of [
      [undefined, "local-test-key"], ["", "local-test-key"],
      ["http://127.0.0.1:56541", undefined], ["http://127.0.0.1:56541", ""],
    ]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
      const response = await proxy(request());
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("skips suffix and prefix placeholder keys with stale auth cookies in DB-off previews", async () => {
    for (const key of ["local-anon-key-placeholder", "placeholder-build-anon-key"]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
      const response = await proxy(request());
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("bypasses browser auth for the signed Stripe webhook", async () => {
    const response = await proxy(new NextRequest("http://127.0.0.1:3000/api/billing/webhook", { method: "POST", body: "signed-body" }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.createClient).not.toHaveBeenCalled(); expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("bypasses browser auth for public health checks, even with stale cookies", async () => {
    const response = await proxy(new NextRequest("http://127.0.0.1:3000/api/health", {
      headers: { Cookie: "sb-local-auth-token.0=stale-token" },
    }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("verifies configured auth with getUser, never trusting getSession", async () => {
    const response = await proxy(request());
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.createClient).toHaveBeenCalledWith("http://127.0.0.1:56541", "local-test-key-not-a-real-credential", {
      cookies: { getAll: expect.any(Function), setAll: expect.any(Function) },
    });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("exposes request cookies through the SDK getAll adapter without changing anonymous ownership", async () => {
    await proxy(request());
    expect(mocks.adapter?.getAll()).toEqual([
      { name: "sb-local-auth-token.0", value: "stale-token" },
      { name: "testero_anon", value: "opaque-owner" },
    ]);
  });

  it("propagates refreshed cookies to both request and response with their security options", async () => {
    const incoming = request();
    mocks.getUser.mockImplementation(async () => {
      mocks.adapter!.setAll([{ name: "sb-local-auth-token.0", value: "fresh-token", options: {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 3600,
      } }]);
      return { data: { user: { id: "verified-user" } }, error: null };
    });
    const response = await proxy(incoming);
    expect(incoming.cookies.get("sb-local-auth-token.0")?.value).toBe("fresh-token");
    expect(incoming.cookies.get("testero_anon")?.value).toBe("opaque-owner");
    expect(mocks.adapter?.getAll()).toContainEqual({ name: "sb-local-auth-token.0", value: "fresh-token" });
    expect(response.cookies.get("sb-local-auth-token.0")).toMatchObject({
      value: "fresh-token", httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 3600,
    });
    expect(response.headers.get("set-cookie")).toContain("fresh-token");
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});
