import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { claimAnonymousDiagnostics } from "@/lib/auth/claim";

const userId = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(64);
function mockClient(result: unknown = { data: 2, error: null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { rpc, client: { rpc } as unknown as Pick<SupabaseClient, "rpc"> };
}
describe("anonymous diagnostic account claim", () => {
  it("sends only the verified user and hash to bulk claim, never token/session ID", async () => {
    const { client, rpc } = mockClient();
    expect(await claimAnonymousDiagnostics(client, userId, token)).toBe(2);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("claim_anonymous_diagnostics", {
      p_user_id: userId, p_anonymous_owner_hash: createHash("sha256").update(token).digest("hex"),
    });
  });
  it.each([null, undefined, "", "a".repeat(63), "a".repeat(65), "A".repeat(64), "G".repeat(64)])
    ("skips RPC for missing/malformed cookie %#", async (value) => {
      const { client, rpc } = mockClient();
      expect(await claimAnonymousDiagnostics(client, userId, value)).toBe(0);
      expect(rpc).not.toHaveBeenCalled();
    });
  it.each(["", "user", "11111111-1111-4111-8111-11111111111z"])
    ("skips RPC for malformed user %#", async (value) => {
      const { client, rpc } = mockClient();
      expect(await claimAnonymousDiagnostics(client, value, token)).toBe(0);
      expect(rpc).not.toHaveBeenCalled();
    });
  it.each([null, "2", -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, {}, undefined])
    ("throws a generic error for malformed return %#", async (data) => {
      const { client } = mockClient({ data, error: null });
      await expect(claimAnonymousDiagnostics(client, userId, token)).rejects.toThrow("Unable to complete account setup.");
    });
  it("accepts zero for duplicate or foreign-cookie claims", async () => {
    const { client } = mockClient({ data: 0, error: null });
    expect(await claimAnonymousDiagnostics(client, userId, token)).toBe(0);
  });
  it("fails closed on RPC errors even with data", async () => {
    const { client } = mockClient({ data: 2, error: { message: "private DB error" } });
    await expect(claimAnonymousDiagnostics(client, userId, token)).rejects.toThrow("Unable to complete account setup.");
  });
  it("fails closed on thrown transport errors", async () => {
    const { client, rpc } = mockClient();
    rpc.mockRejectedValue(new Error("private network error"));
    await expect(claimAnonymousDiagnostics(client, userId, token)).rejects.toThrow("Unable to complete account setup.");
  });
});
