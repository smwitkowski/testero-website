import { z } from 'zod';

// In-memory rate limiter (for dev/demo only)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per window

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

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * Pure signup business logic handler
 * @param {Object} args
 * @param {string} args.email
 * @param {string} args.password
 * @param {string} args.ip
 * @param {object} args.supabaseClient - Must have .auth.signUp({ email, password, options })
 * @param {object} args.analytics - Must have .capture({ event, properties })
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function signupBusinessLogic({ email, password, ip, supabaseClient, analytics }: {
  email: string;
  password: string;
  ip: string;
  supabaseClient: { auth: { signUp: Function } };
  analytics: { capture: Function };
}): Promise<{ status: number, body: any }> {
  // Validate input
  const parse = signupSchema.safeParse({ email, password });
  if (!parse.success) {
    return { status: 400, body: { error: 'Invalid input' } };
  }
  // Rate limiting
  if (!checkRateLimit(ip)) {
    analytics.capture({ event: 'signup_rate_limited', properties: { ip } });
    return { status: 429, body: { error: 'Too many sign-up attempts' } };
  }
  analytics.capture({ event: 'signup_attempt', properties: { email } });
  const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { early_access: false },
    },
  });
  if (error) {
    analytics.capture({ event: 'signup_error', properties: { email, error: error.message } });
    return { status: 400, body: { error: error.message } };
  }
  analytics.capture({ event: 'signup_success', properties: { email } });
  return { status: 200, body: { status: 'ok' } };
} 