import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

// Response body types
export interface ResendConfirmationSuccessResponse {
  status: 'ok';
}

export interface ResendConfirmationErrorResponse {
  error: string;
}

export type ResendConfirmationResponseBody = ResendConfirmationSuccessResponse | ResendConfirmationErrorResponse;

// Response type
export interface ResendConfirmationResponse {
  status: number;
  body: ResendConfirmationResponseBody;
}

const resendConfirmationSchema = z.object({
  email: z.string().email(),
});

// Type for analytics.capture
interface Analytics {
  capture: (event: { event: string; properties: Record<string, unknown> }) => void;
}

/**
 * Pure resend confirmation business logic handler
 * @param {Object} args
 * @param {string} args.email
 * @param {object} args.supabaseClient - Must have .auth.resend method
 * @param {object} args.analytics - Must have .capture({ event, properties, distinctId })
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function resendConfirmationBusinessLogic({ email, supabaseClient, analytics }: {
  email: string;
  supabaseClient: SupabaseClient;
  analytics: Analytics;
}): Promise<ResendConfirmationResponse> {
  // Validate input
  const parse = resendConfirmationSchema.safeParse({ email });
  if (!parse.success) {
    return { status: 400, body: { error: 'Invalid email address' } };
  }

  // Note: Rate limiting is handled at the API route level
  analytics.capture({ 
    event: 'resend_confirmation_requested', 
    properties: { email }
  });

  try {
    // Resend confirmation email with redirect to our verify email page
    const { error } = await supabaseClient.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify-email`,
      },
    });

    if (error) {
      throw error;
    }

    // Track success
    analytics.capture({
      event: 'resend_confirmation_email_sent',
      properties: { email }
    });

    return { status: 200, body: { status: 'ok' } };

  } catch (error) {
    const detailedError = error instanceof Error 
      ? error.message 
      : (typeof error === 'object' && error !== null && 'message' in error)
        ? String((error as any).message)
        : 'Resend confirmation failed';
    
    // Log detailed error server-side for debugging
    console.error('Resend confirmation error:', { email, error: detailedError });
    
    // Track error with detailed information for analytics
    analytics.capture({
      event: 'resend_confirmation_error',
      properties: { email, error: detailedError }
    });

    // Return generic error message to prevent information leakage
    return { status: 400, body: { error: 'Request failed. Please try again.' } };
  }
}