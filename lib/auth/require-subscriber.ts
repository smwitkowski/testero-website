import { NextRequest, NextResponse } from "next/server";
import { getPmleAccessLevelForRequest } from "@/lib/access/pmleEntitlements.server";
import { canUseFeature } from "@/lib/access/pmleEntitlements";

/** Paid-access alias for standalone, unlimited practice APIs.
 * Checkout cookies are not entitlements. Always authenticate and check durable access.
 * Fail closed if auth or the paid-access lookup fails.
 */
export async function requireSubscriber(
  _req: Request | NextRequest,
  _route: string
): Promise<NextResponse | null> {
  void _req;
  void _route;
  try {
    const { user, accessLevel } = await getPmleAccessLevelForRequest();
    if (user && canUseFeature(accessLevel, "PRACTICE_SESSION") &&
        canUseFeature(accessLevel, "EXPLANATIONS")) {
      return null;
    }
  } catch (error) {
    console.error("Paid practice access check failed:", error);
  }
  return NextResponse.json({ code: "PAYWALL" }, { status: 403 });
}
