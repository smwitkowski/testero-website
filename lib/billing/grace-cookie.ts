import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import type { SerializeOptions } from "cookie";

export const PAYWALL_GRACE_COOKIE = "checkout_grace";
const GRACE_COOKIE_TTL_SECONDS = 900; // 15 minutes

export interface SignedCookie {
  name: string;
  value: string;
  options: SerializeOptions;
}

/**
 * Sign a grace cookie indicating successful checkout
 * Cookie expires in 15 minutes
 */
export function signGraceCookie({ userId, checkoutSessionId }: { userId: string; checkoutSessionId: string }): SignedCookie {
  if (!userId || !checkoutSessionId) {
    throw new Error("A user and checkout session are required");
  }
  const secret = process.env.PAYWALL_SIGNING_SECRET;
  if (!secret) {
    throw new Error("PAYWALL_SIGNING_SECRET environment variable is required");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + GRACE_COOKIE_TTL_SECONDS;

  const payload = JSON.stringify({ checkoutSuccess: true, userId, checkoutSessionId, exp });
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  const value = `${Buffer.from(payload).toString("base64url")}.${signature}`;

  return {
    name: PAYWALL_GRACE_COOKIE,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GRACE_COOKIE_TTL_SECONDS,
    },
  };
}

/**
 * Verify a grace cookie from request
 * Returns true if bound confirmation is valid and not expired.
 * This is NOT a paid-access authorization; access is decided by paid-access.ts.
 */
export function verifyGraceCookie(req: NextRequest | Request, userId: string): boolean {
  const secret = process.env.PAYWALL_SIGNING_SECRET;
  if (!secret) {
    return false;
  }

  // Extract cookie value from request
  let cookieValue: string | null = null;

  if (req instanceof NextRequest) {
    cookieValue = req.cookies.get(PAYWALL_GRACE_COOKIE)?.value || null;
  } else {
    // Standard Request object - parse cookie header manually
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim().split("="));
      const cookie = cookies.find(([name]) => name === PAYWALL_GRACE_COOKIE);
      cookieValue = cookie?.[1] || null;
    }
  }

  if (!cookieValue) {
    return false;
  }

  try {
    // Parse value: base64url(payload).signature
    const [encodedPayload, signature] = cookieValue.split(".");
    if (!encodedPayload || !signature) {
      return false;
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));

    // Verify signature
    const expectedSignature = createHmac("sha256", secret).update(JSON.stringify(payload)).digest("base64url");
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return false;
    }

    // Old unbound cookies and missing/invalid expiry fail closed.
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(payload.exp) || payload.exp <= now || payload.exp > now + GRACE_COOKIE_TTL_SECONDS) {
      return false;
    }
    if (!userId || payload.userId !== userId || typeof payload.checkoutSessionId !== "string" || !payload.checkoutSessionId) {
      return false;
    }
    if (payload.checkoutSuccess !== true) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get grace cookie value from request
 */
export function getGraceCookieValue(req: NextRequest | Request): string | null {
  if (req instanceof NextRequest) {
    return req.cookies.get(PAYWALL_GRACE_COOKIE)?.value || null;
  } else {
    // Standard Request object - parse cookie header manually
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim().split("="));
      const cookie = cookies.find(([name]) => name === PAYWALL_GRACE_COOKIE);
      return cookie?.[1] || null;
    }
  }
  return null;
}

/**
 * Check if grace cookie exists in request (regardless of validity)
 */
export function hasGraceCookie(req: NextRequest | Request): boolean {
  return getGraceCookieValue(req) !== null;
}

/**
 * Get cookie clearing options
 * Returns cookie options to clear the grace cookie
 */
export function clearGraceCookie(): SignedCookie {
  return {
    name: PAYWALL_GRACE_COOKIE,
    value: "",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  };
}

