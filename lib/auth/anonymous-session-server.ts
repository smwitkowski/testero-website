/**
 * Anonymous Session Management - Server-side utilities
 * 
 * Server-side utilities for managing anonymous session identifiers via cookies.
 * Used to track guest users across diagnostic sessions.
 * 
 * Note: Client-side functions are in anonymous-session.ts
 */

import { cookies } from 'next/headers';

export const ANONYMOUS_SESSION_COOKIE_NAME = 'testero_anonymous_session_id';

// Cookie configuration
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const COOKIE_OPTIONS = {
  httpOnly: false, // Allow client-side access
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'lax' as const,
  maxAge: COOKIE_MAX_AGE,
  path: '/',
};

/**
 * Server-side: Get anonymous session ID from cookies
 */
export async function getAnonymousSessionIdFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(ANONYMOUS_SESSION_COOKIE_NAME);
    return cookie?.value || null;
  } catch (error) {
    console.error('Error reading anonymous session cookie:', error);
    return null;
  }
}

/**
 * Server-side: Set anonymous session ID in cookies
 */
export async function setAnonymousSessionIdCookie(sessionId: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(ANONYMOUS_SESSION_COOKIE_NAME, sessionId, COOKIE_OPTIONS);
    console.log(`[Anonymous Session] Cookie set: ${sessionId.slice(0, 8)}...`);
  } catch (error) {
    // Expected to fail in server components - that's okay, API routes will handle it
    console.warn('Could not set anonymous session cookie (expected in server components):', error);
  }
}

/**
 * Server-side: Clear anonymous session ID cookie
 */
export async function clearAnonymousSessionIdCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(ANONYMOUS_SESSION_COOKIE_NAME, '', { 
      ...COOKIE_OPTIONS, 
      maxAge: 0 
    });
    console.log('[Anonymous Session] Cookie cleared');
  } catch (error) {
    console.error('Error clearing anonymous session cookie:', error);
  }
}