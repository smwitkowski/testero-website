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
    expect(supabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
      }
    );
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'password_reset_requested', 
      properties: { email: 'test@example.com' }
    });
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'password_reset_email_sent', 
      properties: { email: 'test@example.com' }
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
    expect(supabaseClient.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it('returns 400 for empty email', async () => {
    const res = await passwordResetBusinessLogic({ 
      email: '', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as PasswordResetErrorResponse).error).toBe('Invalid email address');
    expect(supabaseClient.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed email', async () => {
    const res = await passwordResetBusinessLogic({ 
      email: 'test@', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as PasswordResetErrorResponse).error).toBe('Invalid email address');
    expect(supabaseClient.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it('returns 400 when Supabase throws an error', async () => {
    const supabaseError = new Error('User not found');
    supabaseClient.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: supabaseError });
    
    const res = await passwordResetBusinessLogic({ 
      email: 'nonexistent@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as PasswordResetErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'password_reset_requested', 
      properties: { email: 'nonexistent@example.com' }
    });
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'password_reset_error', 
      properties: { email: 'nonexistent@example.com', error: 'User not found' }
    });
  });

  it('returns 400 when Supabase throws non-Error object', async () => {
    supabaseClient.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'Rate limit exceeded' } });
    
    const res = await passwordResetBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as PasswordResetErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'password_reset_error', 
      properties: { email: 'test@example.com', error: 'Rate limit exceeded' }
    });
  });

  it('handles unexpected exceptions gracefully', async () => {
    supabaseClient.auth.resetPasswordForEmail.mockRejectedValueOnce(new Error('Network error'));
    
    const res = await passwordResetBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as PasswordResetErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'password_reset_error', 
      properties: { email: 'test@example.com', error: 'Network error' }
    });
  });

  it('handles unexpected exceptions with non-Error objects', async () => {
    supabaseClient.auth.resetPasswordForEmail.mockRejectedValueOnce('String error');
    
    const res = await passwordResetBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as PasswordResetErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'password_reset_error', 
      properties: { email: 'test@example.com', error: 'Password reset failed' }
    });
  });

  it('uses correct redirect URL with environment variable', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://testero.ai';
    
    const res = await passwordResetBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(200);
    expect(supabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      {
        redirectTo: 'https://testero.ai/reset-password',
      }
    );
    
    // Restore original env
    if (originalEnv) {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  });

  it('uses localhost fallback when NEXT_PUBLIC_SITE_URL is not set', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    
    const res = await passwordResetBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(200);
    expect(supabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      {
        redirectTo: 'http://localhost:3000/reset-password',
      }
    );
    
    // Restore original env
    if (originalEnv) {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    }
  });
});