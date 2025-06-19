import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import VerifyEmailPage from '../app/verify-email/page';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('posthog-js/react', () => ({
  usePostHog: jest.fn(),
}));

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
    },
  },
}));

const mockRouter = {
  push: jest.fn(),
};

const mockPostHog = {
  capture: jest.fn(),
};

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (usePostHog as jest.Mock).mockReturnValue(mockPostHog);

    // Mock window.location.hash
    Object.defineProperty(window, 'location', {
      value: {
        hash: '',
      },
      writable: true,
    });
  });

  test('shows loading state initially', async () => {
    // Set up a valid hash so it doesn't immediately error out
    window.location.hash = '#access_token=valid_token&refresh_token=refresh_token';
    
    const { supabase } = require('@/lib/supabase/client');
    
    // Mock a pending promise to keep the component in loading state
    let resolvePromise: any;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    supabase.auth.setSession.mockReturnValue(pendingPromise);
    
    render(<VerifyEmailPage />);
    
    // Component should start in loading state
    expect(screen.getByText('Verifying Your Email')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we confirm your email address...')).toBeInTheDocument();
    expect(screen.getByText('Confirming your email address...')).toBeInTheDocument();
    
    // Clean up by resolving the promise
    resolvePromise({
      data: { session: null, user: null },
      error: { message: 'Test cleanup' },
    });
  });

  test('shows error state when no access token in URL', async () => {
    window.location.hash = '';
    
    render(<VerifyEmailPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Verification Failed' })).toBeInTheDocument();
    });

    expect(screen.getByText('There was a problem verifying your email')).toBeInTheDocument();
    expect(screen.getByText('No verification token found in URL')).toBeInTheDocument();
    expect(mockPostHog.capture).toHaveBeenCalledWith('email_verification_page_viewed');
    expect(mockPostHog.capture).toHaveBeenCalledWith('email_verification_error', {
      error_message: 'No verification token found in URL',
    });
  });

  test('shows error state when Supabase setSession fails', async () => {
    const { supabase } = require('@/lib/supabase/client');
    
    window.location.hash = '#access_token=valid_token&refresh_token=refresh_token';
    
    // Mock Supabase setSession to reject with an Error
    supabase.auth.setSession.mockRejectedValue(new Error('Invalid token'));

    render(<VerifyEmailPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Verification Failed' })).toBeInTheDocument();
    });

    expect(screen.getByText('There was a problem verifying your email')).toBeInTheDocument();
    expect(screen.getByText('Invalid token')).toBeInTheDocument();
    expect(mockPostHog.capture).toHaveBeenCalledWith('email_verification_page_viewed');
    expect(mockPostHog.capture).toHaveBeenCalledWith('email_verification_error', {
      error_message: 'Invalid token',
    });
  });

  test('shows success state and redirects when verification succeeds', async () => {
    const { supabase } = require('@/lib/supabase/client');
    
    window.location.hash = '#access_token=valid_token&refresh_token=refresh_token';
    
    // Mock successful Supabase setSession
    supabase.auth.setSession.mockResolvedValue({
      data: { 
        session: { user: { id: 'user123', email: 'test@example.com' } },
        user: { id: 'user123', email: 'test@example.com' }
      },
      error: null,
    });

    render(<VerifyEmailPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    });

    expect(screen.getByText('Your account has been successfully verified')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Testero!')).toBeInTheDocument();
    expect(screen.getByText('Continue to Dashboard')).toBeInTheDocument();

    expect(mockPostHog.capture).toHaveBeenCalledWith('email_confirmed', {
      user_id: 'user123',
      email: 'test@example.com',
    });

    // Check that auto-redirect is set up (we can't easily test the setTimeout, but we can check the initial state)
    expect(screen.getByText("You'll be automatically redirected to your dashboard in a few seconds.")).toBeInTheDocument();
  });

  test('tracks page view event on mount', () => {
    render(<VerifyEmailPage />);
    
    expect(mockPostHog.capture).toHaveBeenCalledWith('email_verification_page_viewed');
  });

  test('handles missing refresh token gracefully', async () => {
    const { supabase } = require('@/lib/supabase/client');
    
    window.location.hash = '#access_token=valid_token';
    
    // Mock successful Supabase setSession
    supabase.auth.setSession.mockResolvedValue({
      data: { 
        session: { user: { id: 'user123', email: 'test@example.com' } },
        user: { id: 'user123', email: 'test@example.com' }
      },
      error: null,
    });

    render(<VerifyEmailPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    });

    // Verify setSession was called with empty string for refresh_token when not provided
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'valid_token',
      refresh_token: '',
    });
  });
});