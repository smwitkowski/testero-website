import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PostHog } from 'posthog-node';
import { signupBusinessLogic } from '@/lib/auth/signup-handler';

// --- In-memory rate limiter (for dev/demo only) ---
// This uses a simple Map to track IPs and timestamps.
// For production, use a distributed store (e.g., Redis, Upstash) to ensure correct limits across all serverless instances.
// const rateLimitMap = new Map<string, number[]>();
// const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
// const RATE_LIMIT_MAX = 5; // 5 requests per window

// function checkRateLimit(ip: string): boolean {
//   const now = Date.now();
//   const timestamps = rateLimitMap.get(ip) || [];
//   // Remove timestamps older than window
//   const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
//   if (recent.length >= RATE_LIMIT_MAX) {
//     rateLimitMap.set(ip, recent);
//     return false;
//   }
//   recent.push(now);
//   rateLimitMap.set(ip, recent);
//   return true;
// }

const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || '', {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
});

interface SignupRequestBody {
  email: string;
  password: string;
}

export async function POST(req: NextRequest) {
  let body: SignupRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  // Validate body
  if (
    !body ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string'
  ) {
    return NextResponse.json({ error: 'Invalid request: email and password must be strings' }, { status: 400 });
  }
  const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
  const { email, password } = body;
  const supabaseClient = createServerSupabaseClient();
  const analytics = posthog;
  const result = await signupBusinessLogic({ email, password, ip, supabaseClient, analytics });
  return NextResponse.json(result.body, { status: result.status });
}

// --- Cleanup: flush PostHog events on process exit (for dev/local) ---
if (process.env.NODE_ENV !== 'production') {
  process.on('exit', () => posthog.shutdown());
} 