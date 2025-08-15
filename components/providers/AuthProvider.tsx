"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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

// Route protection is now handled by middleware

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

      // Redirect will be handled by middleware
      window.location.href = "/login";
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
