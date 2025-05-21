import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session if expired - required for Server Components
  // and allows us to get the user in the API routes
  await supabase.auth.getSession();

  // Example: Protect a specific API route
  // Check if the request is for the question submission API
  if (req.nextUrl.pathname === '/api/question/submit') {
    const { data: { user } } = await supabase.auth.getUser();

    // If the user is not authenticated, return a 401 response
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // If authenticated, proceed to the API route handler
  }

  // Continue to the next middleware or the requested route
  return res;
}

// Specify the paths where this middleware should run
export const config = {
  matcher: [
    '/api/question/submit', // Submitting answers requires authentication
    '/api/question/:id*', // Fetching a specific question requires authentication
    '/api/question/current', // Fetching the current question requires authentication
    '/api/questions/list', // Listing questions requires authentication
    /*
     * The following paths are intentionally NOT matched by this middleware
     * as they are designed for unauthenticated access or handled differently:
     * - /api/waitlist (handled by external anti-abuse like Cloudflare)
     * - /api/auth/* (handled by Supabase client-side auth flow)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any other truly public API routes
     */
  ],
};
