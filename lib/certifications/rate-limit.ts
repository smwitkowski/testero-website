import "server-only";
import { createHash } from "node:crypto";

// Best effort only: forwarded headers may be spoofed and instances reset independently.
// The aggregate cap bounds bucket creation even when callers rotate that header. No raw IPs.
const attempts = new Map<string, { count: number; expires: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 5;
const INSTANCE_LIMIT = 100;
let instance = { count: 0, expires: 0 };
export function allowWaitlistRequest(request: Request, now = Date.now()): boolean {
  if (instance.expires <= now) instance = { count: 0, expires: now + WINDOW_MS };
  if (++instance.count > INSTANCE_LIMIT) return false;
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  const address = request.headers.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 200) || "unknown";
  const key = createHash("sha256").update(`cert-waitlist:${address}`).digest("hex");
  const previous = attempts.get(key);
  if (previous) { previous.count++; return previous.count <= LIMIT; }
  attempts.set(key, { count: 1, expires: now + WINDOW_MS });
  return true;
}
