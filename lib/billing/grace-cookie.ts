import { NextRequest } from "next/server";
import { createHmac } from "crypto";

export const PAYWALL_GRACE_COOKIE = "checkout_grace";
const GRACE_COOKIE_TTL_SECONDS = 900; // 15 minutes

interface SignedCookie {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
}

/**
 * Sign a grace cookie indicating successful checkout
 * Cookie expires in 15 minutes
 */
export function signGraceCookie(): SignedCookie {
  const secret = process.env.PAYWALL_SIGNING_SECRET;
  if (!secret) {
    throw new Error("PAYWALL_SIGNING_SECRET environment variable is required");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + GRACE_COOKIE_TTL_SECONDS;

  const payload = JSON.stringify({ checkoutSuccess: true, exp });
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  const value = `${Buffer.from(payload).toString("base64url")}.${signature}`;

  return {
    name: PAYWALL_GRACE_COOKIE,
    value,
    options: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: GRACE_COOKIE_TTL_SECONDS,
    },
  };
}

/**
 * Verify a grace cookie from request
 * Returns true if cookie is valid and not expired
 */
export function verifyGraceCookie(req: NextRequest | Request): boolean {
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
    if (signature !== expectedSignature) {
      return false;
    }

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return false;
    }

    // Verify checkoutSuccess flag
    if (payload.checkoutSuccess !== true) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

