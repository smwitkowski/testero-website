import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface PmlePass {
  id: string;
  paid_at: string;
  expires_at: string;
  refunded_at: string | null;
}

export interface PaidAccess {
  hasPaidAccess: boolean;
  isLegacySubscriber: boolean;
  accessUntil: string | null;
  /** Only an unexpired, unrefunded pass. Historical rows are not access metadata. */
  pass: PmlePass | null;
}

/** Authoritative paid access. Read every time so refunds revoke access immediately. */
export async function getPaidAccess(userId: string): Promise<PaidAccess> {
  const access: PaidAccess = {
    hasPaidAccess: false,
    isLegacySubscriber: false,
    accessUntil: null,
    pass: null,
  };
  if (!userId) return access;

  try {
    const supabase = createServerSupabaseClient();
    // An error in one source must not revoke verified access from the other.
    try {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("status, current_period_end")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!error && data?.status === "active") {
        access.isLegacySubscriber = true;
        access.hasPaidAccess = true;
        access.accessUntil = data.current_period_end ?? null;
      }
    } catch {
      // Fail closed for unverified legacy access; still check passes.
    }

    try {
      const { data, error } = await supabase
        .from("pmle_passes")
        .select("id, paid_at, expires_at, refunded_at")
        .eq("user_id", userId)
        .order("expires_at", { ascending: false });
      if (!error && data) {
        const now = Date.now();
        // A newer refund must not hide another independently valid purchase.
        const validPass = (data as PmlePass[]).find(
          (pass) => pass.refunded_at === null && Date.parse(pass.expires_at) > now
        );
        access.pass = validPass ?? null;
        if (validPass) {
          access.hasPaidAccess = true;
          // A purchased pass keeps its full access window even for legacy users.
          access.accessUntil = validPass.expires_at;
        }
      }
    } catch {
      // Fail closed for unverified passes; retain verified legacy access.
    }
  } catch {
    // Client creation failures also fail closed.
  }
  return access;
}

/** Compatibility alias: subscriber means paid access, not a recurring purchase. */
export async function isSubscriber(userId: string): Promise<boolean> {
  return (await getPaidAccess(userId)).hasPaidAccess;
}

/** Compatibility no-ops. There is deliberately no authorization cache. */
export function clearSubscriberCache(userId: string): void {
  void userId;
}
export function clearAllSubscriberCache(): void {}
