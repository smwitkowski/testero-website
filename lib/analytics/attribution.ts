/** First-party campaign identifiers only. Never store full URLs, referrers, email, or auth tokens.
 * Values are untrusted telemetry and must never be used for authentication or billing. */
export const ATTRIBUTION_COOKIE = "testero_first_touch";
export const ANALYTICS_ID_COOKIE = "testero_analytics_id";
export const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "gclid"] as const;
export type Attribution = Partial<Record<typeof ATTRIBUTION_KEYS[number], string>>;
const MAX_AGE = 90 * 24 * 60 * 60;

export function sanitizeAttribution(value: unknown): Attribution {
  const result: Attribution = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const key of ATTRIBUTION_KEYS) {
    const field = (value as Record<string, unknown>)[key];
    // Campaign slugs and Google's opaque click IDs; reject URL/email/control syntax.
    if (typeof field === "string" && field.length <= (key === "gclid" ? 200 : 120)
      && /^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/.test(field)) result[key] = field;
  }
  return result;
}

export function cookieValue(cookies: string, name: string): string | undefined {
  const value = cookies.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (value === undefined || value.length > 2500) return undefined;
  try { return decodeURIComponent(value); } catch { return undefined; }
}

export function attributionFromCookies(cookies: string): Attribution {
  try { return sanitizeAttribution(JSON.parse(cookieValue(cookies, ATTRIBUTION_COOKIE) ?? "{}")); }
  catch { return {}; }
}

export function isAnalyticsId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
}
export function isAccountId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isKnownBotUserAgent(userAgent: string): boolean {
  return /HeadlessChrome|Playwright|bot\b|crawler|spider|Google-AdWords-Express|AdsBot-Google|Google-Ads|Mediapartners-Google/i.test(userAgent);
}

export function excludedTraffic(cookies: string, userAgent: string): boolean {
  return /(?:^|;\s*)testero_internal=1(?:;|$)/.test(cookies) || isKnownBotUserAgent(userAgent);
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}

/** Synchronous: analyticsHeaders calls this before a start/signup/checkout request can leave. */
export function rememberFirstTouch(): Attribution {
  if (typeof document === "undefined" || typeof window === "undefined") return {};
  try {
    const previous = cookieValue(document.cookie, ATTRIBUTION_COOKIE);
    if (previous !== undefined) {
      try {
        const saved = sanitizeAttribution(JSON.parse(previous));
        // Legacy empty cookies must not prevent the first real campaign from being saved.
        if (Object.keys(saved).length > 0) return saved;
      } catch { /* Replace corrupt cookies. */ }
    }
    const params = new URLSearchParams(window.location.search);
    const first = sanitizeAttribution(Object.fromEntries(ATTRIBUTION_KEYS.map(key => [key, params.get(key)])));
    if (Object.keys(first).length > 0) writeCookie(ATTRIBUTION_COOKIE, JSON.stringify(first));
    return first;
  } catch { return {}; } // Blocked cookies must not block any product flow.
}

export function rememberAnalyticsId(id: string, anonymous: boolean) {
  if (typeof document === "undefined" || typeof window === "undefined" || !isAnalyticsId(id)) return;
  try { writeCookie(ANALYTICS_ID_COOKIE, `${anonymous ? "a" : "i"}.${id}`); } catch { /* Optional telemetry. */ }
}

export function browserIdentity(cookies: string): { id: string; anonymous: boolean } | undefined {
  const value = cookieValue(cookies, ANALYTICS_ID_COOKIE);
  if (!value || !/^[ai]\./.test(value) || !isAnalyticsId(value.slice(2))) return undefined;
  return { id: value.slice(2), anonymous: value.startsWith("a.") };
}

export function firstTouchPersonProperties(first: Attribution): Record<string, string> {
  return Object.fromEntries(Object.entries(sanitizeAttribution(first)).map(([key, value]) => [`$initial_${key}`, value]));
}

/** Server-controlled collection marker survives Stripe webhooks, which have no browser cookie. */
export function checkoutAnalyticsMetadata(request: Request): Record<string, string> {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || excludedTraffic(request.headers.get("cookie") ?? "", request.headers.get("user-agent") ?? "")) return { analytics_enabled: "0" };
  return { analytics_enabled: "1", ...attributionFromCookies(request.headers.get("cookie") ?? "") };
}
