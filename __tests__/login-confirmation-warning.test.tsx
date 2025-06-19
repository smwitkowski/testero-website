import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { usePostHog } from 'posthog-js/react';
import LoginPage from '@/app/login/page';
import { supabase } from '@/lib/supabase/client';

// Mock PostHog
jest.mock('posthog-js/react', () => ({
  usePostHog: jest.fn(),
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock fetch for resend confirmation API
global.fetch = jest.fn();

describe('Login Page - Confirmation Warning', () => {
  const mockPostHog = {
    capture: jest.fn(),
  };

  beforeEach(() => {
    (usePostHog as jest.Mock).mockReturnValue(mockPostHog);
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('shows confirmation warning when user email is not confirmed', async () => {
    // Mock Supabase to return email not confirmed error
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      error: { message: 'Email not confirmed' },
    });

    render(<LoginPage />);

    // Fill in the form
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Wait for confirmation warning to appear
    await waitFor(() => {
      expect(screen.getByText('Email confirmation required')).toBeInTheDocument();
    });

    expect(screen.getByText('Please check your email and click the confirmation link to activate your account.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend confirmation email/i })).toBeInTheDocument();

    // Verify PostHog tracking
    expect(mockPostHog.capture).toHaveBeenCalledWith('login_unconfirmed_user', {
      email: 'test@example.com',
    });
  });

  it('handles resend confirmation email successfully', async () => {
    // Mock Supabase to return email not confirmed error
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      error: { message: 'Email not confirmed' },
    });

    // Mock successful resend API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    render(<LoginPage />);

    // Trigger confirmation warning
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Email confirmation required')).toBeInTheDocument();
    });

    // Click resend button
    const resendButton = screen.getByRole('button', { name: /resend confirmation email/i });
    fireEvent.click(resendButton);

    // Verify API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'test@example.com' }),
      });
    });

    // Verify success message appears
    await waitFor(() => {
      expect(screen.getByText('Confirmation email sent successfully!')).toBeInTheDocument();
    });

    // Verify PostHog tracking for resend success
    expect(mockPostHog.capture).toHaveBeenCalledWith('login_resend_confirmation_success', {
      email: 'test@example.com',
    });
  });

  it('handles resend confirmation email error', async () => {
    // Mock Supabase to return email not confirmed error
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      error: { message: 'Email not confirmed' },
    });

    // Mock failed resend API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Too many requests' }),
    });

    render(<LoginPage />);

    // Trigger confirmation warning
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Email confirmation required')).toBeInTheDocument();
    });

    // Click resend button
    const resendButton = screen.getByRole('button', { name: /resend confirmation email/i });
    fireEvent.click(resendButton);

    // Verify error message appears
    await waitFor(() => {
      expect(screen.getByText('Failed to send confirmation email. Please try again.')).toBeInTheDocument();
    });

    // Verify PostHog tracking for resend error
    expect(mockPostHog.capture).toHaveBeenCalledWith('login_resend_confirmation_error', {
      email: 'test@example.com',
      error_message: 'Too many requests',
    });
  });

  it('shows cooldown timer after successful resend', async () => {
    // Mock Supabase to return email not confirmed error
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      error: { message: 'Email not confirmed' },
    });

    // Mock successful resend API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    render(<LoginPage />);

    // Trigger confirmation warning and resend
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Email confirmation required')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /resend confirmation email/i }));

    // Verify cooldown timer appears
    await waitFor(() => {
      expect(screen.getByText(/Resend in \d+s/)).toBeInTheDocument();
    });

    // Verify button is disabled during cooldown
    const resendButton = screen.getByRole('button', { name: /Resend in \d+s/ });
    expect(resendButton).toBeDisabled();
  });

  it('does not show confirmation warning for other login errors', async () => {
    // Mock Supabase to return different error
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    render(<LoginPage />);

    // Fill in the form
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'wrongpassword' },
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Wait a moment for any async operations
    await waitFor(() => {
      // Confirmation warning should not appear
      expect(screen.queryByText('Email confirmation required')).not.toBeInTheDocument();
    });
    
    // Verify PostHog tracking for regular error (this confirms the error handling path was taken)
    expect(mockPostHog.capture).toHaveBeenCalledWith('login_error', {
      error_message: 'Something went wrong. Please try again.',
    });
  });

  it('fixes navigation link to point to signup page', () => {
    render(<LoginPage />);

    const signupLink = screen.getByRole('link', { name: /create an account/i });
    expect(signupLink).toHaveAttribute('href', '/signup');
  });
});