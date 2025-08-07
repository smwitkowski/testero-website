"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { usePostHog } from "posthog-js/react";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// List of routes that don't require authentication
const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/waitlist",
  "/content",
  "/faq",
  "/diagnostic",
  "/study-path",
];
// List of routes that should redirect to dashboard if already authenticated
const authRoutes = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const posthog = usePostHog();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Get the initial session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error fetching session:", error.message);
        }

        handleSessionChange(data.session);
      } catch (err) {
        console.error("Unexpected error during session fetch:", err);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial session fetch
    fetchSession();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionChange(session);
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle routing based on authentication status
  useEffect(() => {
    // Skip during initial load or when no pathname
    if (isLoading || !pathname) return;

    const isPublicRoute = publicRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    const isAuthRoute = authRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    console.log("[Auth Routing]", {
      pathname,
      isPublicRoute,
      isAuthRoute,
      isAuthenticated: !!session,
      userMetadata: session?.user?.user_metadata,
      isEarlyAccess: session?.user?.user_metadata?.is_early_access === true,
    });

    // If user is authenticated
    if (session) {
      // If on an auth route, redirect to the main app page
      if (isAuthRoute) {
        console.log("[Auth Routing] Redirecting from auth route to dashboard");
        router.push("/dashboard");
      } else if (!isPublicRoute) {
        // If on a protected route, check early access flag
        const isEarlyAccess = session.user?.user_metadata?.is_early_access === true;
        if (!isEarlyAccess) {
          // Redirect users who are logged in but not in early access
          console.log("[Auth Routing] User not in early access, redirecting to coming soon page");
          router.push("/early-access-coming-soon"); // Redirect to a specific page
        } else {
          console.log("[Auth Routing] User has early access, allowing access to protected route");
        }
        // If they have early access, they stay on the protected page
      }
      // If on a public route and authenticated, they can stay on the public route
    } else {
      // If user is NOT authenticated
      // If on a protected route, redirect to login
      if (!isPublicRoute) {
        console.log("[Auth Routing] Unauthenticated user on protected route, redirecting to login");
        router.push("/login");
      }
      // If on a public route and not authenticated, they can stay on the public route
    }
  }, [isLoading, session, pathname, router]); // Dependencies remain the same

  const handleSessionChange = (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user || null);

    // Identify user in PostHog when session changes
    if (newSession?.user && posthog) {
      // Identify the user with their ID
      posthog.identify(newSession.user.id, {
        email: newSession.user.email,
        created_at: newSession.user.created_at,
        is_early_access: newSession.user.user_metadata?.is_early_access === true,
        email_confirmed: !!newSession.user.email_confirmed_at,
        // Add any other user metadata that might be useful
        provider: newSession.user.app_metadata?.provider || "email",
      });

      // Track successful login/session restoration
      posthog.capture("user_session_started", {
        session_type: "authenticated",
        user_id: newSession.user.id,
      });
    } else if (!newSession && posthog) {
      // Reset PostHog when user logs out
      posthog.reset();

      // Track logout
      posthog.capture("user_session_ended", {
        session_type: "logged_out",
      });
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear the session state
      setSession(null);
      setUser(null);

      // Redirect to login
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.refreshSession();

      if (error) throw error;

      handleSessionChange(data.session);
    } catch (error) {
      console.error("Error refreshing session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, isLoading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
