import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Stripe authenticates with the raw-body signature, never browser auth.
  if (request.nextUrl.pathname === "/api/billing/webhook") return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || key.includes("placeholder")) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: options?.sameSite ?? "lax", secure: options?.secure ?? process.env.NODE_ENV === "production", path: options?.path ?? "/" }));
      },
    },
  });
  // Verified auth, not getSession(): this also refreshes expiring SSR tokens.
  await supabase.auth.getUser();
  return response;
}
export const config = { matcher: ["/((?!api/billing/webhook(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
