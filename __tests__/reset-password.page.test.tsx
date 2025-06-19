/** @jest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';

// Mock Next.js router and search params
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock PostHog
const captureMock = jest.fn();
jest.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: captureMock }),
}));

// Mock Supabase client
const signInMock = jest.fn();
const updateUserMock = jest.fn();
jest.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: signInMock,
      updateUser: updateUserMock,
    },
  },
}));

// Import after mocks
import ResetPasswordPage from '../app/reset-password/page';

const mockPush = jest.fn();
const mockGet = jest.fn();

beforeEach(() => {
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
  });
  (useSearchParams as jest.Mock).mockReturnValue({
    get: mockGet,
  });
  signInMock.mockReset();
  updateUserMock.mockReset();
  captureMock.mockClear();
  mockPush.mockClear();
  mockGet.mockClear();
});

describe('ResetPasswordPage', () => {
  test('renders reset password form with valid token', () => {
    mockGet.mockReturnValue('valid-token-123');
    
    render(<ResetPasswordPage />);
    
    expect(screen.getByRole('heading', { name: /set new password/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/new password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
  });

  test('shows error when token is missing', () => {
    mockGet.mockReturnValue(null);
    
    render(<ResetPasswordPage />);
    
    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request new reset link/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/new password/i)).not.toBeInTheDocument();
  });

  test('shows validation errors for empty form submission', async () => {
    mockGet.mockReturnValue('valid-token-123');
    
    render(<ResetPasswordPage />);
    
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  test('shows validation error for short password', async () => {
    mockGet.mockReturnValue('valid-token-123');
    
    render(<ResetPasswordPage />);
    
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'short');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  test('shows validation error for password mismatch', async () => {
    mockGet.mockReturnValue('valid-token-123');
    
    render(<ResetPasswordPage />);
    
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'password123');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'different123');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  test('successfully updates password and redirects to login', async () => {
    mockGet.mockReturnValue('valid-token-123');
    updateUserMock.mockResolvedValue({ error: null });
    
    render(<ResetPasswordPage />);
    
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'newpassword123');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'newpassword123');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    
    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });

    expect(captureMock).toHaveBeenCalledWith('password_reset_success');
    expect(await screen.findByText(/password updated successfully/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  test('shows loading state during password update', async () => {
    mockGet.mockReturnValue('valid-token-123');
    updateUserMock.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ error: null }), 100))
    );
    
    render(<ResetPasswordPage />);
    
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'newpassword123');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'newpassword123');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    
    expect(screen.getByText(/updating/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /updating/i })).toBeDisabled();
  });

  test('handles Supabase errors gracefully', async () => {
    mockGet.mockReturnValue('invalid-token');
    updateUserMock.mockResolvedValue({
      error: { message: 'Invalid or expired reset token' },
    });
    
    render(<ResetPasswordPage />);
    
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'newpassword123');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'newpassword123');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    
    expect(await screen.findByText(/invalid or expired reset token/i)).toBeInTheDocument();
    
    expect(captureMock).toHaveBeenCalledWith('password_reset_error', {
      error: 'Invalid or expired reset token',
    });
  });

  test('handles network errors', async () => {
    mockGet.mockReturnValue('valid-token-123');
    updateUserMock.mockRejectedValue(new Error('Network error'));
    
    render(<ResetPasswordPage />);
    
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'newpassword123');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'newpassword123');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    
    expect(await screen.findByText(/something went wrong. please try again/i)).toBeInTheDocument();
  });

  test('prevents multiple form submissions', async () => {
    mockGet.mockReturnValue('valid-token-123');
    updateUserMock.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ error: null }), 100))
    );
    
    render(<ResetPasswordPage />);
    
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'newpassword123');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'newpassword123');
    
    const submitButton = screen.getByRole('button', { name: /update password/i });
    
    // Click multiple times
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);
    
    // Should only make one API call
    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledTimes(1);
    });
  });

  test('shows password strength indicator', async () => {
    mockGet.mockReturnValue('valid-token-123');
    
    render(<ResetPasswordPage />);
    
    const passwordInput = screen.getByPlaceholderText(/new password/i);
    
    // Type weak password
    await userEvent.type(passwordInput, 'weak');
    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    
    // Type strong password
    await userEvent.clear(passwordInput);
    await userEvent.type(passwordInput, 'StrongPassword123!');
    expect(screen.queryByText(/password must be at least 8 characters/i)).not.toBeInTheDocument();
  });

  test('maintains accessibility standards', () => {
    mockGet.mockReturnValue('valid-token-123');
    
    render(<ResetPasswordPage />);
    
    const passwordInput = screen.getByPlaceholderText(/new password/i);
    const confirmInput = screen.getByPlaceholderText(/confirm password/i);
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
    expect(passwordInput).toHaveAttribute('aria-required', 'true');
    
    expect(confirmInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('autoComplete', 'new-password');
    expect(confirmInput).toHaveAttribute('aria-required', 'true');
    
    const submitButton = screen.getByRole('button', { name: /update password/i });
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  test('clears validation errors when user starts typing', async () => {
    mockGet.mockReturnValue('valid-token-123');
    
    render(<ResetPasswordPage />);
    
    // Trigger validation error
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    
    // Start typing - error should clear
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'test');
    expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument();
  });

  test('provides link to request new reset when token is invalid', () => {
    mockGet.mockReturnValue(null);
    
    render(<ResetPasswordPage />);
    
    const resetLink = screen.getByRole('link', { name: /request new reset link/i });
    expect(resetLink).toHaveAttribute('href', '/forgot-password');
  });

  test('shows appropriate error message structure', async () => {
    mockGet.mockReturnValue('valid-token-123');
    updateUserMock.mockResolvedValue({
      error: { message: 'Test error message' },
    });
    
    render(<ResetPasswordPage />);
    
    await userEvent.type(screen.getByPlaceholderText(/new password/i), 'newpassword123');
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), 'newpassword123');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    
    const errorElement = await screen.findByRole('alert');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveAttribute('aria-live', 'assertive');
    expect(errorElement).toHaveTextContent(/test error message/i);
  });

  test('handles token validation on component mount', () => {
    // Test with malformed token
    mockGet.mockReturnValue('');
    
    render(<ResetPasswordPage />);
    
    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
  });
});