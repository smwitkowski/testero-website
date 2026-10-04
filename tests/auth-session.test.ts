import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { getVerifiedUser, claimVerifiedDiagnostics } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { claimAnonymousDiagnostics } from "@/lib/auth/claim";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), cookie: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => mocks.cookie ? { value: mocks.cookie } : undefined })) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn(() => ({ marker: "service" })) }));
vi.mock("@/lib/auth/claim", () => ({ claimAnonymousDiagnostics: vi.fn(async () => 1) }));
const user = { id: "server-verified-id", email_confirmed_at: "2026-10-03" } as User;
beforeEach(() => {
  mocks.cookie = undefined;
  mocks.getUser.mockReset().mockResolvedValue({ data: { user }, error: null });
  vi.mocked(createServerSupabaseClient).mockReset().mockResolvedValue({ auth: { getUser: mocks.getUser } } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);
});
describe("confirmed auth sessions", () => {
  it("returns confirmed getUser result", async () => expect(await getVerifiedUser()).toBe(user));
  it.each([null, { id: "unconfirmed" }, { ...user, email_confirmed_at: "" }])("denies missing confirmation %#", async unverified => {
    mocks.getUser.mockResolvedValue({ data: { user: unverified }, error: null });
    expect(await getVerifiedUser()).toBeNull();
  });
  it("denies SDK errors even if a user was returned", async () => {
    mocks.getUser.mockResolvedValue({ data: { user }, error: { message: "private" } });
    expect(await getVerifiedUser()).toBeNull();
  });
  it("denies thrown verification/config errors without leaking", async () => {
    mocks.getUser.mockRejectedValue(new Error("private email and token"));
    expect(await getVerifiedUser()).toBeNull();
    vi.mocked(createServerSupabaseClient).mockRejectedValue(new Error("private"));
    expect(await getVerifiedUser()).toBeNull();
  });
  it("never creates service client for an unconfirmed identity", async () => {
    mocks.cookie = "a".repeat(64);
    await claimVerifiedDiagnostics({ id: "fake" } as User);
    expect(createServiceSupabaseClient).not.toHaveBeenCalled();
    expect(claimAnonymousDiagnostics).not.toHaveBeenCalled();
  });
  it("passes only the raw protected cookie and verified ID to hashing claim helper", async () => {
    mocks.cookie = "a".repeat(64);
    await claimVerifiedDiagnostics(user);
    expect(claimAnonymousDiagnostics).toHaveBeenCalledWith({ marker: "service" }, user.id, mocks.cookie);
  });
});
