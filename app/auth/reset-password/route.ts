import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Get the token_hash and type from the query parameters
  const searchParams = req.nextUrl.searchParams;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Build the redirect URL with the correct path
  const redirectUrl = new URL("/reset-password", req.nextUrl.origin);

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
