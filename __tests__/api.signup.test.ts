import { signupBusinessLogic } from '../lib/auth/signup-handler';
import { rateLimitMap } from '../lib/auth/signup-handler';

describe('signupBusinessLogic', () => {
  let supabaseClient: any;
  let analytics: any;

  beforeEach(() => {
    rateLimitMap.clear();
    supabaseClient = {
      auth: {
        signUp: jest.fn().mockResolvedValue({ error: null }),
      },
    };
    analytics = {
      capture: jest.fn(),
    };
  });

  it('returns 200 OK for valid email/password', async () => {
    const res = await signupBusinessLogic({ email: 'test@example.com', password: 'password123', ip: '1.1.1.1', supabaseClient, analytics });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(analytics.capture).toHaveBeenCalledWith({ event: 'signup_success', properties: { email: 'test@example.com' } });
  });

  it('returns 400 for invalid email', async () => {
    const res = await signupBusinessLogic({ email: 'bad', password: 'password123', ip: '1.1.1.1', supabaseClient, analytics });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  it('returns 400 for short password', async () => {
    const res = await signupBusinessLogic({ email: 'test@example.com', password: 'short', ip: '1.1.1.1', supabaseClient, analytics });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  it('returns 429 for repeated attempts (rate limit)', async () => {
    // Hit the endpoint 5 times to fill the rate limit
    for (let i = 0; i < 5; i++) {
      await signupBusinessLogic({ email: 'test2@example.com', password: 'password123', ip: '2.2.2.2', supabaseClient, analytics });
    }
    // 6th attempt should be rate limited
    const res = await signupBusinessLogic({ email: 'test2@example.com', password: 'password123', ip: '2.2.2.2', supabaseClient, analytics });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too many sign-up attempts');
    expect(analytics.capture).toHaveBeenCalledWith({ event: 'signup_rate_limited', properties: { ip: '2.2.2.2' } });
  });

  it('returns 400 for duplicate email (Supabase error)', async () => {
    supabaseClient.auth.signUp.mockResolvedValueOnce({ error: { message: 'Email already in use' } });
    const res = await signupBusinessLogic({ email: 'dupe@example.com', password: 'password123', ip: '3.3.3.3', supabaseClient, analytics });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email already in use');
    expect(analytics.capture).toHaveBeenCalledWith({ event: 'signup_error', properties: { email: 'dupe@example.com', error: 'Email already in use' } });
  });
}); 