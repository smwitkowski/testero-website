import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// Response body types
export interface PasswordResetSuccessResponse {
  status: 'ok';
}

export interface PasswordResetErrorResponse {
  error: string;
}

export type PasswordResetResponseBody = PasswordResetSuccessResponse | PasswordResetErrorResponse;

// Response type
export interface PasswordResetResponse {
  status: number;
  body: PasswordResetResponseBody;
}

const passwordResetSchema = z.object({
  email: z.string().email(),
});

// Type for analytics.capture
interface Analytics {
  capture: (event: { event: string; properties: Record<string, unknown>; distinctId: string }) => void;
}

/**
 * Pure password reset business logic handler
 * @param {Object} args
 * @param {string} args.email
 * @param {object} args.supabaseClient - Must have .auth.resetPasswordForEmail()
 * @param {object} args.analytics - Must have .capture({ event, properties, distinctId })
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function passwordResetBusinessLogic({ email, supabaseClient, analytics }: {
  email: string;
  supabaseClient: SupabaseClient;
  analytics: Analytics;
}): Promise<PasswordResetResponse> {
  // Validate input
  const parse = passwordResetSchema.safeParse({ email });
  if (!parse.success) {
    return { status: 400, body: { error: 'Invalid email address' } };
  }

  // Note: Rate limiting is handled at the API route level
  analytics.capture({ 
    event: 'password_reset_requested', 
    properties: { email },
    distinctId: email
  });

  try {
    // Request password reset with redirect to our reset password page
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
    });

    if (error) {
      throw new Error(error.message || 'Password reset failed');
    }

    // Track success
    analytics.capture({
      event: 'password_reset_email_sent',
      properties: { email },
      distinctId: email
    });

    return { status: 200, body: { status: 'ok' } };

  } catch (error) {
    const detailedError = error instanceof Error ? error.message : 'Password reset failed';
    
    // Log detailed error server-side for debugging
    console.error('Password reset error:', { email, error: detailedError });
    
    // Track detailed error for analytics
    analytics.capture({ 
      event: 'password_reset_error', 
      properties: { email, error: detailedError },
      distinctId: email
    });
    
    // Return generic error message to prevent information leakage
    return { status: 400, body: { error: 'Request failed. Please try again.' } };
  }
}