import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAnonymousToken } from "@/lib/diagnostic/ownership";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Call only after server auth verifies the user. Never accepts a browser user ID. */
export async function claimAnonymousDiagnostics(
  client: Pick<SupabaseClient, "rpc">,
  userId: string,
  token: string | null | undefined,
): Promise<number> {
  const hash = hashAnonymousToken(token);
  if (!hash || !UUID.test(userId)) return 0;
  try {
    const { data, error } = await client.rpc("claim_anonymous_diagnostics", {
      p_user_id: userId,
      p_anonymous_owner_hash: hash,
    });
    if (error || typeof data !== "number" || !Number.isSafeInteger(data) || data < 0) {
      throw new Error("Unable to complete account setup.");
    }
    return data;
  } catch {
    // Do not pretend a failed claim succeeded; never expose DB details.
    throw new Error("Unable to complete account setup.");
  }
}
