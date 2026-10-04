import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const ANONYMOUS_COOKIE = "testero_anon";
export const ANONYMOUS_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const HEX_TOKEN = /^[a-f0-9]{64}$/;
export interface SessionOwner { user_id: string | null; anonymous_owner_hash: string | null }
export interface OwnerCredentials { userId: string | null; anonymousToken: string | null }
export function createAnonymousToken(): string { return randomBytes(32).toString("hex"); }
export function hashAnonymousToken(token: string | null | undefined): string | null {
  return token && HEX_TOKEN.test(token) ? createHash("sha256").update(token).digest("hex") : null;
}
/** One owner only. User IDs come from verified server auth, never request JSON. */
export function ownsSession(owner: SessionOwner, credentials: OwnerCredentials): boolean {
  if (typeof owner.user_id === "string" && owner.user_id.length > 0 && owner.anonymous_owner_hash === null) return owner.user_id === credentials.userId;
  if (owner.user_id !== null || typeof owner.anonymous_owner_hash !== "string" || !HEX_TOKEN.test(owner.anonymous_owner_hash)) return false;
  const suppliedHash = hashAnonymousToken(credentials.anonymousToken);
  return !!suppliedHash && timingSafeEqual(Buffer.from(owner.anonymous_owner_hash, "hex"), Buffer.from(suppliedHash, "hex"));
}
export function canAccessSession(owner: SessionOwner & { expires_at: string; completed_at: string | null }, credentials: OwnerCredentials, now = Date.now()): boolean {
  if (!ownsSession(owner, credentials)) return false;
  return !!owner.completed_at || Date.parse(owner.expires_at) > now;
}
