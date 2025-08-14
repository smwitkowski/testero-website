import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Use shared public route configuration
  const { isPublicRouteForMiddleware, isAuthRoute } = await import("@/lib/config/routes");
  const isPublicRoute = isPublicRouteForMiddleware(request.nextUrl.pathname);
  const isAuth = isAuthRoute(request.nextUrl.pathname);

  // If user is authenticated
  if (user) {
    // If on an auth route, redirect to dashboard
    if (isAuth) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    
    // If on a protected route, check early access
    if (!isPublicRoute) {
      const isEarlyAccess = user.user_metadata?.is_early_access === true;
      if (!isEarlyAccess) {
        const url = request.nextUrl.clone();
        url.pathname = "/early-access-coming-soon";
        return NextResponse.redirect(url);
      }
    }
  } else {
    // If user is not authenticated and trying to access a protected route
    if (!isPublicRoute) {
      // Redirect to login with return URL
      const url = request.nextUrl.clone();
      const returnUrl = request.nextUrl.pathname + request.nextUrl.search;
      url.pathname = "/login";
      if (returnUrl && returnUrl !== "/") {
        url.searchParams.set("redirect", returnUrl);
      }
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object instead of the supabaseResponse object

  return supabaseResponse;
}
