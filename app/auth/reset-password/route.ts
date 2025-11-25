import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Get the token_hash and type from the query parameters
  const searchParams = req.nextUrl.searchParams;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Use NEXT_PUBLIC_SITE_URL for redirects to avoid using internal container URLs
  // This is critical in Cloud Run where req.nextUrl.origin may return 0.0.0.0:3000
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

  // Build the redirect URL with the correct path
  const redirectUrl = new URL("/reset-password", siteUrl);

  // Preserve query parameters
  if (token_hash) {
    redirectUrl.searchParams.set("token_hash", token_hash);
  }
  if (type) {
    redirectUrl.searchParams.set("type", type);
  }

  // Redirect to the correct password reset page
  return NextResponse.redirect(redirectUrl);
}
