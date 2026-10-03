import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/require-user";
import { getVerifiedUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));
beforeEach(() => vi.mocked(getVerifiedUser).mockReset().mockResolvedValue(null));
describe("protected page helper", () => {
  it.each(["/account", "/dashboard", "/practice", "/reset-password"])("redirects signed-out %s to login with safe next", async path => {
    await expect(requireUser(path)).rejects.toThrow(`REDIRECT:/login?next=${encodeURIComponent(path)}`);
    expect(redirect).toHaveBeenCalledWith(`/login?next=${encodeURIComponent(path)}`);
  });
  it("does not allow external login return paths", async () => await expect(requireUser("//evil.example")).rejects.toThrow("REDIRECT:/login?next=%2Fdashboard"));
  it("returns only the verified server user", async () => {
    const user = { id: "verified", email_confirmed_at: "2026-10-03" } as User;
    vi.mocked(getVerifiedUser).mockResolvedValue(user);
    expect(await requireUser("/account")).toBe(user); expect(redirect).not.toHaveBeenCalled();
  });
});
