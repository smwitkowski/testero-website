import { passwordResetBusinessLogic, PasswordResetResponse, PasswordResetSuccessResponse, PasswordResetErrorResponse } from '../lib/auth/password-reset-handler';

describe('passwordResetBusinessLogic', () => {
  let supabaseClient: any;
  let analytics: any;

  beforeEach(() => {
    supabaseClient = {
      auth: {
        resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
      },
    };
    analytics = {
      capture: jest.fn(),
    };
  });

  it('returns 200 OK for valid email', async () => {
    const res = await passwordResetBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(200);
    expect((res.body as PasswordResetSuccessResponse).status).toBe('ok');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'password_reset_requested', 
      properties: { email: 'test@example.com' },
      distinctId: 'test@example.com'
    });
    expect(analytics.capture).toHaveBeenCalledWith({
      event: 'password_reset_email_sent',
      properties: { email: 'test@example.com' },
      distinctId: 'test@example.com'
    });
  });

  it('returns 400 for invalid email', async () => {
    const res = await passwordResetBusinessLogic({ 
      email: 'invalid-email', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as PasswordResetErrorResponse).error).toBe('Invalid email address');
  });

  it('returns 400 for Supabase error', async () => {
    const mockError = { message: 'User not found' };
    supabaseClient.auth.resetPasswordForEmail.mockResolvedValueOnce({ 
      error: mockError
    });
    
    const res = await passwordResetBusinessLogic({ 
      email: 'notfound@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as PasswordResetErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith(expect.objectContaining({ 
      event: 'password_reset_error', 
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
    
    await passwordResetBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(supabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      { redirectTo: 'https://testero.ai/reset-password' }
    );
    
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  it('falls back to localhost when NEXT_PUBLIC_SITE_URL is not set', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    
    await passwordResetBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(supabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      { redirectTo: 'http://localhost:3000/reset-password' }
    );
    
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  it('handles unexpected errors gracefully', async () => {
    supabaseClient.auth.resetPasswordForEmail.mockRejectedValueOnce(
      new Error('Network error')
    );
    
    const res = await passwordResetBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as PasswordResetErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'password_reset_error', 
      properties: { email: 'test@example.com', error: 'Network error' },
      distinctId: 'test@example.com'
    });
  });
});