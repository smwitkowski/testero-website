import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

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
  /** Only an unexpired, unrefunded pass. */
  pass: PmlePass | null;
  /** Verification failed. Never interpret this as permission to charge. */
  unavailable?: boolean;
}
const freeAccess = (): PaidAccess => ({ hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  // Date.parse normalizes impossible dates such as February 30. Reject them.
  const day = value.slice(0, 10);
  return new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}
function validPass(value: unknown): value is PmlePass {
  if (!value || typeof value !== "object") return false;
  const pass = value as PmlePass;
  return typeof pass.id === "string" && UUID.test(pass.id) && timestamp(pass.paid_at) && timestamp(pass.expires_at)
    && Date.parse(pass.expires_at) > Date.parse(pass.paid_at)
    && (pass.refunded_at === null || timestamp(pass.refunded_at));
}

/** Shared predicate for safe, active metadata; malformed rows never grant access. */
export function isActivePass(pass: unknown, now = Date.now()): pass is PmlePass {
  return Number.isFinite(now) && validPass(pass) && pass.refunded_at === null
    && Date.parse(pass.paid_at) <= now && Date.parse(pass.expires_at) > now;
}

/** Server callers must supply a verified user id. No browser authorization/cache. */
export async function readPaidAccess(userId: string, client?: SupabaseClient, now = Date.now()): Promise<PaidAccess> {
  noStore();
  if (!UUID.test(userId) || !Number.isFinite(now)) throw new Error("Paid access unavailable");
  const supabase = client ?? createServiceSupabaseClient();
  // Both sources must be readable, including when the first source grants access.
  const { data: legacy, error: legacyError } = await supabase.from("user_subscriptions")
    .select("status,current_period_end").eq("user_id", userId).eq("status", "active").limit(1).maybeSingle();
  const { data: passes, error: passError } = await supabase.from("pmle_passes")
    .select("id,paid_at,expires_at,refunded_at").eq("user_id", userId).order("expires_at", { ascending: false });
  if (legacyError || passError || (legacy !== null && (!legacy || typeof legacy !== "object" || legacy.status !== "active" || (legacy.current_period_end !== null && !timestamp(legacy.current_period_end))))
    || !Array.isArray(passes) || !passes.every(validPass)) throw new Error("Paid access unavailable");
  const pass = [...passes].sort((a, b) => Date.parse(b.expires_at) - Date.parse(a.expires_at))
    .find(row => isActivePass(row, now));
  const access = freeAccess();
  if (legacy) {
    access.hasPaidAccess = true;
    access.isLegacySubscriber = true;
    access.accessUntil = legacy.current_period_end;
  }
  if (pass) {
    access.hasPaidAccess = true;
    access.accessUntil = pass.expires_at;
    // Whitelist metadata; never return provider/customer identifiers.
    access.pass = { id: pass.id, paid_at: pass.paid_at, expires_at: pass.expires_at, refunded_at: null };
  }
  return access;
}

/** Any error in either source revokes the whole decision, not just that source. */
export async function getPaidAccess(userId: string, client?: SupabaseClient, now = Date.now()): Promise<PaidAccess> {
  try { return await readPaidAccess(userId, client, now); }
  catch { return { ...freeAccess(), unavailable: true }; }
}
export async function isSubscriber(userId: string): Promise<boolean> { return (await getPaidAccess(userId)).hasPaidAccess; }
/** Compatibility no-ops: authorization is always fresh. */
export function clearSubscriberCache(userId: string): void { void userId; }
export function clearAllSubscriberCache(): void {}
