import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signGraceCookie } from "@/lib/billing/grace-cookie";

/**
 * Handle Stripe checkout success redirect
 * Sets a signed grace cookie and redirects to billing dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    
    // Sign and set grace cookie
    const { name, value, options } = signGraceCookie();
    const cookieStore = await cookies();
    cookieStore.set(name, value, options);
    
    // Redirect to billing dashboard with success flag
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?success=1`);
  } catch (error) {
    console.error("[Checkout Success] Error setting grace cookie:", error);
    // Fallback: redirect without cookie if signing fails
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${siteUrl}/dashboard/billing?success=1`);
  }
}

