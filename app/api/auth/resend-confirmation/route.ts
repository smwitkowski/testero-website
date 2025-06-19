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

const resendConfirmationSchema = z.object({
  email: z.string().email(),
});

interface ResendConfirmationRequestBody {
  email: string;
}

export async function POST(req: NextRequest) {
  let body: ResendConfirmationRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate input
  const parse = resendConfirmationSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const { email } = parse.data;

  // Rate limiting
  if (!checkRateLimit(ip)) {
    posthog.capture({
      event: 'resend_confirmation_rate_limited',
      properties: { ip, email },
      distinctId: email
    });
    return NextResponse.json({ error: 'Too many resend confirmation attempts' }, { status: 429 });
  }

  const supabaseClient = createServerSupabaseClient();

  try {
    // Track attempt
    posthog.capture({
      event: 'resend_confirmation_requested',
      properties: { email },
      distinctId: email
    });

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
    posthog.capture({
      event: 'resend_confirmation_email_sent',
      properties: { email },
      distinctId: email
    });

    return NextResponse.json({ status: 'ok' }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Resend confirmation failed';
    
    // Track error
    posthog.capture({
      event: 'resend_confirmation_error',
      properties: { email, error: errorMessage },
      distinctId: email
    });

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

// Cleanup: flush PostHog events on process exit (for dev/local)
if (process.env.NODE_ENV !== 'production') {
  process.on('exit', () => posthog.shutdown());
}