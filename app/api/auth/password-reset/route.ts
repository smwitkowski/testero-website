import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PostHog } from 'posthog-node';
import { z } from 'zod';

// In-memory rate limiter (should be replaced with Redis in production)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per window

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || '', {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
});

const passwordResetSchema = z.object({
  email: z.string().email(),
});

interface PasswordResetRequestBody {
  email: string;
}

export async function POST(req: NextRequest) {
  let body: PasswordResetRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate input
  const parse = passwordResetSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const { email } = parse.data;

  // Rate limiting
  if (!checkRateLimit(ip)) {
    posthog.capture({
      event: 'password_reset_rate_limited',
      properties: { ip, email },
      distinctId: email
    });
    return NextResponse.json({ error: 'Too many password reset attempts' }, { status: 429 });
  }

  const supabaseClient = createServerSupabaseClient();

  try {
    // Track attempt
    posthog.capture({
      event: 'password_reset_requested',
      properties: { email },
      distinctId: email
    });

    // Request password reset with redirect to our reset password page
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
    });

    if (error) {
      throw error;
    }

    // Track success
    posthog.capture({
      event: 'password_reset_email_sent',
      properties: { email },
      distinctId: email
    });

    return NextResponse.json({ status: 'ok' }, { status: 200 });

  } catch (error) {
    const detailedError = error instanceof Error ? error.message : 'Password reset failed';
    
    // Log detailed error server-side for debugging
    console.error('Password reset error:', { email, error: detailedError });
    
    // Track error with detailed information for analytics
    posthog.capture({
      event: 'password_reset_error',
      properties: { email, error: detailedError },
      distinctId: email
    });

    // Return generic error message to prevent information leakage
    return NextResponse.json({ error: 'Request failed. Please try again.' }, { status: 400 });
  }
}

// Cleanup: flush PostHog events on process exit (for dev/local)
if (process.env.NODE_ENV !== 'production') {
  process.on('exit', () => posthog.shutdown());
}