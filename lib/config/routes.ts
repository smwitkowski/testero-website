/**
 * Shared route configuration to prevent duplication between middleware and AuthProvider
 * This ensures consistent route protection across server-side middleware and client-side routing
 */

// Routes that don't require authentication
export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup", 
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth/confirm", // PKCE-style email confirmation endpoint
  "/waitlist",
  "/beta",
  "/content",
  "/faq",
  "/diagnostic",
  "/study-path", // Keep study-path public for preview mode
  "/pricing",
  "/blog",
] as const;

// API routes that don't require authentication
export const PUBLIC_API_ROUTES = [
  "/api/diagnostic",
  "/api/auth",
  "/api/waitlist",
] as const;

// Static/system routes that should always be accessible
export const SYSTEM_ROUTES = [
  "/_next",
  "/favicon.ico",
] as const;

// Auth-specific routes that should redirect authenticated users to dashboard
// Note: /verify-email is excluded to allow authenticated users to see the success screen
export const AUTH_ROUTES = [
  "/login", 
  "/signup", 
  "/forgot-password", 
  "/reset-password"
] as const;

// All public routes combined for middleware usage
export const ALL_PUBLIC_ROUTES = [
  ...PUBLIC_ROUTES,
  ...PUBLIC_API_ROUTES, 
  ...SYSTEM_ROUTES,
] as const;

/**
 * Check if a route is public (doesn't require authentication)
 * @param pathname - The pathname to check
 * @returns boolean - True if the route is public
 */
export const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
};

/**
 * Check if a route is an authentication route
 * @param pathname - The pathname to check
 * @returns boolean - True if the route is an auth route
 */
export const isAuthRoute = (pathname: string): boolean => {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
};

/**
 * Check if a route is public for middleware (includes API and system routes)
 * @param pathname - The pathname to check
 * @returns boolean - True if the route should be accessible without auth
 */
export const isPublicRouteForMiddleware = (pathname: string): boolean => {
  return ALL_PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
};