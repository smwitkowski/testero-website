import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PostHog } from 'posthog-node';
import { resendConfirmationBusinessLogic } from '@/lib/auth/resend-confirmation-handler';

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

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const { email } = body;

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

  // Delegate business logic to handler
  const result = await resendConfirmationBusinessLogic({
    email,
    supabaseClient,
    analytics: posthog
  });

  return NextResponse.json(result.body, { status: result.status });
}

// Cleanup: flush PostHog events on process exit (for dev/local)
if (process.env.NODE_ENV !== 'production') {
  process.on('exit', () => posthog.shutdown());
}