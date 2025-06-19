/**
 * Anonymous Session Management - Client-side utilities
 * 
 * Client-side utilities for managing anonymous session identifiers via cookies and localStorage.
 * Used to track guest users across diagnostic sessions.
 * 
 * Note: Server-side functions are in anonymous-session-server.ts
 */

export const ANONYMOUS_SESSION_COOKIE_NAME = 'testero_anonymous_session_id';
export const ANONYMOUS_SESSION_STORAGE_KEY = 'anonymousSessionId';

// Cookie configuration
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Client-side: Get anonymous session ID from localStorage (fallback)
 * This function should only be called on the client side
 */
export function getAnonymousSessionIdFromStorage(): string | null {
  if (typeof window === 'undefined') {
    return null; // Server-side safety check
  }
  
  try {
    return localStorage.getItem(ANONYMOUS_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Error reading anonymous session from localStorage:', error);
    return null;
  }
}

/**
 * Client-side: Set anonymous session ID in localStorage
 * This function should only be called on the client side
 */
export function setAnonymousSessionIdInStorage(sessionId: string): void {
  if (typeof window === 'undefined') {
    return; // Server-side safety check
  }
  
  try {
    localStorage.setItem(ANONYMOUS_SESSION_STORAGE_KEY, sessionId);
    console.log(`[Anonymous Session] localStorage set: ${sessionId.slice(0, 8)}...`);
  } catch (error) {
    console.error('Error storing anonymous session in localStorage:', error);
  }
}

/**
 * Client-side: Clear anonymous session ID from localStorage
 */
export function clearAnonymousSessionIdFromStorage(): void {
  if (typeof window === 'undefined') {
    return; // Server-side safety check
  }
  
  try {
    localStorage.removeItem(ANONYMOUS_SESSION_STORAGE_KEY);
    console.log('[Anonymous Session] localStorage cleared');
  } catch (error) {
    console.error('Error clearing anonymous session from localStorage:', error);
  }
}

/**
 * Client-side: Get anonymous session ID from cookies using document.cookie
 * Fallback for client-side cookie reading
 */
export function getAnonymousSessionIdFromClientCookie(): string | null {
  if (typeof document === 'undefined') {
    return null; // Server-side safety check
  }
  
  try {
    const cookies = document.cookie.split(';');
    const targetCookie = cookies.find(cookie => 
      cookie.trim().startsWith(`${ANONYMOUS_SESSION_COOKIE_NAME}=`)
    );
    
    if (targetCookie) {
      return targetCookie.split('=')[1]?.trim() || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error reading anonymous session from client cookie:', error);
    return null;
  }
}

/**
 * Client-side: Set anonymous session ID in cookies using document.cookie
 */
export function setAnonymousSessionIdInClientCookie(sessionId: string): void {
  if (typeof document === 'undefined') {
    return; // Server-side safety check
  }
  
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    const cookieString = `${ANONYMOUS_SESSION_COOKIE_NAME}=${sessionId}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    document.cookie = cookieString;
    console.log(`[Anonymous Session] Client cookie set: ${sessionId.slice(0, 8)}...`);
  } catch (error) {
    console.error('Error setting anonymous session in client cookie:', error);
  }
}

/**
 * Client-side: Get anonymous session ID with fallback chain
 * Tries: cookie → localStorage → null
 */
export function getAnonymousSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null; // Server-side safety check
  }
  
  // Try cookie first
  let sessionId = getAnonymousSessionIdFromClientCookie();
  if (sessionId) {
    return sessionId;
  }
  
  // Fallback to localStorage
  sessionId = getAnonymousSessionIdFromStorage();
  if (sessionId) {
    // If found in localStorage but not cookie, sync them
    setAnonymousSessionIdInClientCookie(sessionId);
    return sessionId;
  }
  
  return null;
}

/**
 * Client-side: Set anonymous session ID in both cookie and localStorage
 */
export function setAnonymousSessionId(sessionId: string): void {
  if (typeof window === 'undefined') {
    return; // Server-side safety check
  }
  
  setAnonymousSessionIdInClientCookie(sessionId);
  setAnonymousSessionIdInStorage(sessionId);
}

/**
 * Client-side: Clear anonymous session ID from both cookie and localStorage
 */
export function clearAnonymousSessionId(): void {
  if (typeof window === 'undefined') {
    return; // Server-side safety check
  }
  
  // Clear cookie by setting it with past expiration
  try {
    document.cookie = `${ANONYMOUS_SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch (error) {
    console.error('Error clearing anonymous session client cookie:', error);
  }
  
  clearAnonymousSessionIdFromStorage();
}

/**
 * Generate a new UUID for anonymous sessions
 */
export function generateAnonymousSessionId(): string {
  return crypto.randomUUID();
}