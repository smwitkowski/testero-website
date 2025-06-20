import { signupBusinessLogic, SignupResponse, SignupSuccessResponse, SignupErrorResponse } from '../lib/auth/signup-handler';

describe('signupBusinessLogic', () => {
  let supabaseClient: any;
  let analytics: any;

  beforeEach(() => {
    // Rate limiting is now handled at API route level
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
    const res = await signupBusinessLogic({ email: 'test@example.com', password: 'password123', supabaseClient, analytics });
    expect(res.status).toBe(200);
    expect((res.body as SignupSuccessResponse).status).toBe('ok');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'signup_success', 
      properties: { 
        email: 'test@example.com',
        guestUpgraded: false,
        sessionsTransferred: 0
      } 
    });
  });

  it('returns 400 for invalid email', async () => {
    const res = await signupBusinessLogic({ email: 'bad', password: 'password123', supabaseClient, analytics });
    expect(res.status).toBe(400);
    expect((res.body as SignupErrorResponse).error).toBe('Invalid email or password');
  });

  it('returns 400 for short password', async () => {
    const res = await signupBusinessLogic({ email: 'test@example.com', password: 'short', supabaseClient, analytics });
    expect(res.status).toBe(400);
    expect((res.body as SignupErrorResponse).error).toBe('Invalid email or password');
  });

  // Rate limiting test removed - now handled at API route level

  it('returns 400 for duplicate email (Supabase error)', async () => {
    supabaseClient.auth.signUp.mockResolvedValueOnce({ error: { message: 'Email already in use' } });
    const res = await signupBusinessLogic({ email: 'dupe@example.com', password: 'password123', supabaseClient, analytics });
    expect(res.status).toBe(400);
    expect((res.body as SignupErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ event: 'signup_error', properties: { email: 'dupe@example.com', error: 'Email already in use' } });
  });
}); 