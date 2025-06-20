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
    expect(supabaseClient.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'test@example.com',
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify-email`,
      },
    });
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'resend_confirmation_requested', 
      properties: { email: 'test@example.com' }
    });
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'resend_confirmation_email_sent', 
      properties: { email: 'test@example.com' }
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
    expect(supabaseClient.auth.resend).not.toHaveBeenCalled();
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it('returns 400 for empty email', async () => {
    const res = await resendConfirmationBusinessLogic({ 
      email: '', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as ResendConfirmationErrorResponse).error).toBe('Invalid email address');
    expect(supabaseClient.auth.resend).not.toHaveBeenCalled();
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed email', async () => {
    const res = await resendConfirmationBusinessLogic({ 
      email: 'test@', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as ResendConfirmationErrorResponse).error).toBe('Invalid email address');
    expect(supabaseClient.auth.resend).not.toHaveBeenCalled();
    expect(analytics.capture).not.toHaveBeenCalled();
  });

  it('returns 400 when Supabase throws an error', async () => {
    const supabaseError = new Error('User already confirmed');
    supabaseClient.auth.resend.mockResolvedValueOnce({ error: supabaseError });
    
    const res = await resendConfirmationBusinessLogic({ 
      email: 'confirmed@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as ResendConfirmationErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'resend_confirmation_requested', 
      properties: { email: 'confirmed@example.com' }
    });
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'resend_confirmation_error', 
      properties: { email: 'confirmed@example.com', error: 'User already confirmed' }
    });
  });

  it('returns 400 when Supabase throws non-Error object', async () => {
    supabaseClient.auth.resend.mockResolvedValueOnce({ error: { message: 'Rate limit exceeded' } });
    
    const res = await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as ResendConfirmationErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'resend_confirmation_error', 
      properties: { email: 'test@example.com', error: 'Rate limit exceeded' }
    });
  });

  it('handles unexpected exceptions gracefully', async () => {
    supabaseClient.auth.resend.mockRejectedValueOnce(new Error('Network error'));
    
    const res = await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as ResendConfirmationErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'resend_confirmation_error', 
      properties: { email: 'test@example.com', error: 'Network error' }
    });
  });

  it('handles unexpected exceptions with non-Error objects', async () => {
    supabaseClient.auth.resend.mockRejectedValueOnce('String error');
    
    const res = await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(400);
    expect((res.body as ResendConfirmationErrorResponse).error).toBe('Request failed. Please try again.');
    expect(analytics.capture).toHaveBeenCalledWith({ 
      event: 'resend_confirmation_error', 
      properties: { email: 'test@example.com', error: 'Resend confirmation failed' }
    });
  });

  it('uses correct redirect URL with environment variable', async () => {
    const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://testero.ai';
    
    const res = await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(200);
    expect(supabaseClient.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'test@example.com',
      options: {
        emailRedirectTo: 'https://testero.ai/verify-email',
      },
    });
    
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
    
    const res = await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(200);
    expect(supabaseClient.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'test@example.com',
      options: {
        emailRedirectTo: 'http://localhost:3000/verify-email',
      },
    });
    
    // Restore original env
    if (originalEnv) {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    }
  });

  it('uses correct resend type for signup confirmation', async () => {
    const res = await resendConfirmationBusinessLogic({ 
      email: 'test@example.com', 
      supabaseClient, 
      analytics 
    });
    
    expect(res.status).toBe(200);
    expect(supabaseClient.auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'signup'
      })
    );
  });
});