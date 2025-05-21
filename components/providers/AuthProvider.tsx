"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// List of routes that don't require authentication
const publicRoutes = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/waitlist', '/content', '/faq'];
// List of routes that should redirect to dashboard if already authenticated
const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Get the initial session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error fetching session:', error.message);
        }
        
        handleSessionChange(data.session);
      } catch (err) {
        console.error('Unexpected error during session fetch:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial session fetch
    fetchSession();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSessionChange(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle routing based on authentication status
  useEffect(() => {
    // Skip during initial load or when no pathname
    if (isLoading || !pathname) return;

    // Check if the current route is a protected route
    const isPublicRoute = publicRoutes.some(route => 
      pathname === route || pathname.startsWith(`${route}/`)
    );
    
    const isAuthRoute = authRoutes.some(route => 
      pathname === route || pathname.startsWith(`${route}/`)
    );

    // Protected route but no user
    if (!isPublicRoute && !session) {
      router.push('/login');
    }

    // Auth route but user is already logged in
    if (isAuthRoute && session) {
      router.push('/practice/question');
    }

    // Check for early access flag if user is authenticated and not on a public route
    if (session && !isPublicRoute) {
      // Assuming 'is_early_access' is stored in user_metadata
      const isEarlyAccess = session.user?.user_metadata?.is_early_access === true;

      if (!isEarlyAccess) {
        // Redirect users who are logged in but not in early access
        router.push('/early-access-coming-soon'); // Redirect to a specific page
      }
    }

  }, [isLoading, session, pathname, router]);

  const handleSessionChange = (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user || null);
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
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
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
      console.error('Error refreshing session:', error);
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
