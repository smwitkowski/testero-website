import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// Response body types
export interface SignupSuccessResponse {
  status: 'ok';
  guestUpgraded?: boolean;
  sessionsTransferred?: number;
}

export interface SignupErrorResponse {
  error: string;
}

export type SignupResponseBody = SignupSuccessResponse | SignupErrorResponse;

// Response type
export interface SignupResponse {
  status: number;
  body: SignupResponseBody;
}

// Note: Rate limiting is now handled at the API route level to maintain consistency
// across all auth endpoints and avoid double rate limiting.

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Type for analytics.capture
interface Analytics {
  capture: (event: { event: string; properties: Record<string, unknown> }) => void;
}

/**
 * Upgrade guest sessions by transferring anonymous sessions to the new user
 * @param supabaseClient - Supabase client instance
 * @param userId - The new user's ID
 * @param anonymousSessionId - The anonymous session ID to upgrade
 * @param analytics - Analytics instance for tracking
 * @returns Promise<{ transferred: number; error?: string }>
 */
/**
 * Upgrades anonymous diagnostic sessions to a registered user
 * Exported for use in claim-anonymous-sessions endpoint
 */
export async function upgradeGuestSessions(
  supabaseClient: SupabaseClient, 
  userId: string, 
  anonymousSessionId: string, 
  analytics: Analytics
): Promise<{ transferred: number; error?: string }> {
  try {
    // Start a transaction-like operation by finding all anonymous sessions
    const { data: anonymousSessions, error: fetchError } = await supabaseClient
      .from('diagnostics_sessions')
      .select('id, exam_type, started_at, completed_at, question_count')
      .eq('anonymous_session_id', anonymousSessionId)
      .is('user_id', null);

    if (fetchError) {
      console.error('Error fetching anonymous sessions for upgrade:', fetchError);
      return { transferred: 0, error: fetchError.message };
    }

    if (!anonymousSessions || anonymousSessions.length === 0) {
      // No sessions to upgrade - this is normal for new users
      return { transferred: 0 };
    }

    // Update all anonymous sessions to be owned by the new user
    const { error: updateError } = await supabaseClient
      .from('diagnostics_sessions')
      .update({ 
        user_id: userId,
        anonymous_session_id: null // Clear the anonymous session ID
      })
      .eq('anonymous_session_id', anonymousSessionId)
      .is('user_id', null);

    if (updateError) {
      console.error('Error upgrading anonymous sessions:', updateError);
      return { transferred: 0, error: updateError.message };
    }

    // Track analytics for the upgrade
    const completedSessions = anonymousSessions.filter(s => s.completed_at).length;
    const activeSessions = anonymousSessions.filter(s => !s.completed_at).length;
    const totalQuestions = anonymousSessions.reduce((sum, s) => sum + (s.question_count || 0), 0);

    analytics.capture({
      event: 'guest_upgraded',
      properties: {
        userId,
        sessionsTransferred: anonymousSessions.length,
        completedSessions,
        activeSessions,
        totalQuestionsAnswered: totalQuestions,
        examTypes: [...new Set(anonymousSessions.map(s => s.exam_type))],
        oldestSession: anonymousSessions.reduce((oldest, s) => 
          !oldest || new Date(s.started_at) < new Date(oldest) ? s.started_at : oldest, null
        ),
      }
    });

    console.log(`Successfully upgraded ${anonymousSessions.length} guest sessions for user ${userId}`);
    return { transferred: anonymousSessions.length };

  } catch (error) {
    console.error('Unexpected error during guest session upgrade:', error);
    return { 
      transferred: 0, 
      error: error instanceof Error ? error.message : 'Unknown error during upgrade'
    };
  }
}

/**
 * Pure signup business logic handler
 * @param {Object} args
 * @param {string} args.email
 * @param {string} args.password
 * @param {object} args.supabaseClient - Must have .auth.signUp({ email, password, options })
 * @param {object} args.analytics - Must have .capture({ event, properties })
 * @param {string} [args.anonymousSessionId] - Optional anonymous session ID for guest upgrade
 * @param {string} [args.redirect] - Optional redirect URL to include in verification email
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function signupBusinessLogic({ email, password, supabaseClient, analytics, anonymousSessionId, redirect }: {
  email: string;
  password: string;
  supabaseClient: SupabaseClient;
  analytics: Analytics;
  anonymousSessionId?: string;
  redirect?: string;
}): Promise<SignupResponse> {
  // Validate input
  const parse = signupSchema.safeParse({ email, password });
  if (!parse.success) {
    return { status: 400, body: { error: 'Invalid email or password' } };
  }
  // Note: Rate limiting is handled at the API route level
  analytics.capture({ event: 'signup_attempt', properties: { 
    email, 
    hasAnonymousSession: !!anonymousSessionId 
  } });
  
  // Build verification redirect URL with optional redirect param
  // Email verification is enabled for anti-abuse (prevents throwaway accounts bypassing gates)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const verifyEmailUrl = redirect 
    ? `${baseUrl}/verify-email?redirect=${encodeURIComponent(redirect)}`
    : `${baseUrl}/verify-email`;

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { is_early_access: false },
      emailRedirectTo: verifyEmailUrl,
    },
  });
  
  if (error) {
    // Log detailed error server-side for debugging
    console.error('Signup error:', { email, error: error.message });
    
    // Track detailed error for analytics
    analytics.capture({ event: 'signup_error', properties: { email, error: error.message } });
    
    // Return generic error message to prevent information leakage
    return { status: 400, body: { error: 'Request failed. Please try again.' } };
  }

  // Handle guest session upgrade only if user has an authenticated session
  // If email verification is enabled, data.session will be null, so we defer upgrade
  // until after email verification completes (via /api/auth/claim-anonymous-sessions)
  let guestUpgraded = false;
  let sessionsTransferred = 0;
  
  const hasAuthSession = !!data.session;
  
  if (anonymousSessionId && data.user?.id && hasAuthSession) {
    // Only upgrade if we have an authenticated session (email confirmations disabled)
    const upgradeResult = await upgradeGuestSessions(
      supabaseClient,
      data.user.id,
      anonymousSessionId,
      analytics
    );
    
    if (upgradeResult.error) {
      // Log the error but don't fail the signup
      console.error('Guest session upgrade failed:', upgradeResult.error);
      analytics.capture({ 
        event: 'guest_upgrade_error', 
        properties: { 
          email, 
          error: upgradeResult.error,
          anonymousSessionId: anonymousSessionId.slice(0, 8) + '...' // Partial ID for privacy
        } 
      });
    } else {
      guestUpgraded = upgradeResult.transferred > 0;
      sessionsTransferred = upgradeResult.transferred;
    }
  } else if (anonymousSessionId && data.user?.id && !hasAuthSession) {
    // Email verification required - defer upgrade until after verification
    // This prevents the diagnostic session from being bound to user_id before user is authenticated
    console.log('Deferring guest session upgrade until email verification completes');
  }
  
  analytics.capture({ 
    event: 'signup_success', 
    properties: { 
      email,
      guestUpgraded,
      sessionsTransferred
    } 
  });
  
  const responseBody: SignupSuccessResponse = { 
    status: 'ok',
    ...(guestUpgraded && { guestUpgraded, sessionsTransferred })
  };
  
  return { status: 200, body: responseBody };
}

// Removed rateLimitMap export as rate limiting is now handled at API route level 