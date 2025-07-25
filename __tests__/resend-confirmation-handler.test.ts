import { resendConfirmationBusinessLogic, ResendConfirmationResponse, ResendConfirmationSuccessResponse, ResendConfirmationErrorResponse } from '../lib/auth/resend-confirmation-handler';

describe('resendConfirmationBusinessLogic', () => {
  let supabaseClient: any;
  let analytics: any;

  beforeEach(() => {
    supabaseClient = {
      auth: {
        resend: jest.fn().mockResolvedValue({ error: null }),
      },
    };
    analytics = {
      capture: jest.fn(),
    };
  });

  it('returns 200 OK for valid email', async () => {
    const res = await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(200);
    expect((res.body as ResendConfirmationSuccessResponse).status).toBe('ok');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'resend_confirmation_requested', 
      properties: { email: 'test@example.com' },
      distinctId: 'test@example.com'
    });
    expect(analytics.capture).toHaveBeenCalledWith({
      event: 'resend_confirmation_email_sent',
      properties: { email: 'test@example.com' },
      distinctId: 'test@example.com'
    });
  });

  it('returns 400 for invalid email', async () => {
    const res = await resendConfirmationBusinessLogic({ 
      email: 'invalid-email', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as ResendConfirmationErrorResponse).error).toBe('Invalid email address');
  });

  it('returns 400 for Supabase error', async () => {
    const mockError = { message: 'User not found' };
    supabaseClient.auth.resend.mockResolvedValueOnce({ 
      error: mockError
    });
    
    const res = await resendConfirmationBusinessLogic({ 
      email: 'notfound@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as ResendConfirmationErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith(expect.objectContaining({ 
      event: 'resend_confirmation_error', 
      properties: expect.objectContaining({ 
        email: 'notfound@example.com', 
        error: 'User not found' 
      }),
      distinctId: 'notfound@example.com'
    }));
  });

  it('uses correct redirect URL with NEXT_PUBLIC_SITE_URL', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://testero.ai';
    
    await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(supabaseClient.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'test@example.com',
      options: {
        emailRedirectTo: 'https://testero.ai/verify-email'
      }
    });
    
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  it('falls back to localhost when NEXT_PUBLIC_SITE_URL is not set', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    
    await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(supabaseClient.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'test@example.com',
      options: {
        emailRedirectTo: 'http://localhost:3000/verify-email'
      }
    });
    
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  it('handles unexpected errors gracefully', async () => {
    supabaseClient.auth.resend.mockRejectedValueOnce(
      new Error('Network error')
    );
    
    const res = await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as ResendConfirmationErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'resend_confirmation_error', 
      properties: { email: 'test@example.com', error: 'Network error' },
      distinctId: 'test@example.com'
    });
  });
});