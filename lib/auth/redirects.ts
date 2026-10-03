/** Only local paths may cross the auth boundary. Decode to reject nested escapes too. */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  let decoded = value;
  for (let i = 0; i < 5; i++) {
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded) || /[a-z][a-z0-9+.-]*:/i.test(decoded)) return fallback;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return value;
      decoded = next;
    } catch { return fallback; }
  }
  return fallback;
}
export function signupDestination(next: string): string {
  const url = new URL(safeNext(next), "https://internal.invalid");
  url.searchParams.set("signup", "confirmed");
  return `${url.pathname}${url.search}${url.hash}`;
}
/** Same-origin writes are checked before this is used. Never trust x-forwarded-host. */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host) { url.port = ""; url.host = host; }
  const protocol = request.headers.get("x-forwarded-proto");
  if (protocol === "https" || protocol === "http") url.protocol = `${protocol}:`;
  return url.origin;
}
