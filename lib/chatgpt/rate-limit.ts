import "server-only";
import { createHash } from "node:crypto";

// Same best-effort, bounded, hashed-IP pattern as the public certification waitlist.
// Each instance has its own buckets. Forwarded headers depend on the trusted ingress.
const attempts = new Map<string, { count: number; expires: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 60;
const INSTANCE_LIMIT = 600;
let instance = { count: 0, expires: 0 };
export function allowMcpRequest(request: Request, now = Date.now()): boolean {
  if (instance.expires <= now) instance = { count: 0, expires: now + WINDOW_MS };
  if (++instance.count > INSTANCE_LIMIT) return false;
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  const address = request.headers.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 200) || "unknown";
  const key = createHash("sha256").update(`chatgpt-mcp:${address}`).digest("hex");
  const previous = attempts.get(key);
  if (previous) { previous.count++; return previous.count <= LIMIT; }
  attempts.set(key, { count: 1, expires: now + WINDOW_MS });
  return true;
}
