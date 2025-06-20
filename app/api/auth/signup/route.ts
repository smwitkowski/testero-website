import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PostHog } from 'posthog-node';
import { z } from 'zod';
import { signupBusinessLogic } from '@/lib/auth/signup-handler';
import { getAnonymousSessionIdFromCookie, clearAnonymousSessionIdCookie } from '@/lib/auth/anonymous-session-server';

// --- In-memory rate limiter (for dev/demo only) ---
// This uses a simple Map to track IPs and timestamps.
// For production, use a distributed store (e.g., Redis, Upstash) to ensure correct limits across all serverless instances.
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per window (standardized with other auth endpoints)

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  // Remove timestamps older than window
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

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  anonymousSessionId: z.string().optional(),
});

interface SignupRequestBody {
  email: string;
  password: string;
  anonymousSessionId?: string;
}

export async function POST(req: NextRequest) {
  let body: SignupRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate input
  const parse = signupSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const { email, password, anonymousSessionId: requestAnonymousSessionId } = parse.data;

  // Rate limiting
  if (!checkRateLimit(ip)) {
    posthog.capture({
      event: 'signup_rate_limited',
      properties: { ip, email },
      distinctId: email
    });
    return NextResponse.json({ error: 'Too many sign-up attempts' }, { status: 429 });
  }
  
  // Get anonymous session ID from cookie as fallback
  const cookieAnonymousSessionId = await getAnonymousSessionIdFromCookie();
  const effectiveAnonymousSessionId = requestAnonymousSessionId || cookieAnonymousSessionId || undefined;
  const supabaseClient = createServerSupabaseClient();
  
  // Create analytics wrapper to match expected interface
  const analytics = {
    capture: (event: { event: string; properties: Record<string, unknown> }) => {
      posthog.capture({
        event: event.event,
        properties: event.properties,
        distinctId: email || 'anonymous'
      });
    }
  };
  
  const result = await signupBusinessLogic({ 
    email, 
    password, 
    supabaseClient, 
    analytics,
    anonymousSessionId: effectiveAnonymousSessionId 
  });
  
  // Clear anonymous session cookie if signup was successful and we had an anonymous session
  if (result.status === 200 && effectiveAnonymousSessionId) {
    try {
      await clearAnonymousSessionIdCookie();
    } catch (error) {
      console.warn('Failed to clear anonymous session cookie after signup:', error);
      // Don't fail the signup if cookie clearing fails
    }
  }
  
  return NextResponse.json(result.body, { status: result.status });
}

// --- Cleanup: flush PostHog events on process exit (for dev/local) ---
if (process.env.NODE_ENV !== 'production') {
  process.on('exit', () => posthog.shutdown());
} 