/** @jest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const captureMock = jest.fn();

jest.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: captureMock }),
}));

// Mock the anonymous session utility
jest.mock('../lib/auth/anonymous-session', () => ({
  getAnonymousSessionId: jest.fn(() => 'mock-anonymous-session-id'),
}));

// Mock fetch globally
global.fetch = jest.fn();

import SignupPage from '../app/signup/page';

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
  captureMock.mockClear();
});

test('shows validation errors for empty submission', async () => {
  render(<SignupPage />);
  const button = screen.getByRole('button', { name: /sign up/i });
  await userEvent.click(button);
  expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('submits valid form and shows confirmation', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'ok', guestUpgraded: false, sessionsTransferred: 0 }),
  });

  render(<SignupPage />);
  await userEvent.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
  await userEvent.type(screen.getByPlaceholderText(/password/i), 'password123');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        anonymousSessionId: 'mock-anonymous-session-id',
      }),
    });
  });

  expect(captureMock).toHaveBeenCalledWith('signup_attempt');
  expect(captureMock).toHaveBeenCalledWith('signup_success', {
    guestUpgraded: false,
    sessionsTransferred: 0,
  });
  expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
});

test('handles API errors correctly', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Email already registered' }),
  });

  render(<SignupPage />);
  await userEvent.type(screen.getByPlaceholderText(/email address/i), 'existing@example.com');
  await userEvent.type(screen.getByPlaceholderText(/password/i), 'password123');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

  expect(await screen.findByText(/email already registered/i)).toBeInTheDocument();
  expect(captureMock).toHaveBeenCalledWith('signup_attempt');
  expect(captureMock).toHaveBeenCalledWith('signup_error', {
    error_message: 'Email already registered',
  });
});

describe('Signup Attribution Tracking', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  test('includes attribution properties when marker exists from diagnostic summary', async () => {
    const localStorageMock = window.localStorage as unknown as {
      getItem: jest.Mock;
      setItem: jest.Mock;
      removeItem: jest.Mock;
    };

    // Set attribution marker (as if user clicked signup CTA from diagnostic summary)
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'signup_attribution_source') return 'diagnostic_summary';
      if (key === 'signup_attribution_variant') return 'risk_qualifier';
      if (key === 'signup_attribution_sessionId') return 'test-session-123';
      if (key === 'signup_attribution_timestamp') return (Date.now() - 5000).toString(); // 5 seconds ago
      return null;
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', guestUpgraded: false, sessionsTransferred: 0 }),
    });

    render(<SignupPage />);
    await userEvent.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      // Verify signup_attempt includes attribution
      expect(captureMock).toHaveBeenCalledWith(
        'signup_attempt',
        expect.objectContaining({
          source: 'diagnostic_summary',
          signup_attribution_source: 'diagnostic_summary',
          signup_attribution_variant: 'risk_qualifier',
          signup_module_copy_variant: 'risk_qualifier',
          signup_attribution_sessionId: 'test-session-123',
          ms_since_summary_view: expect.any(Number),
        })
      );

      // Verify signup_success includes attribution
      expect(captureMock).toHaveBeenCalledWith(
        'signup_success',
        expect.objectContaining({
          guestUpgraded: false,
          sessionsTransferred: 0,
          signup_attribution_source: 'diagnostic_summary',
          signup_attribution_variant: 'risk_qualifier',
          signup_module_copy_variant: 'risk_qualifier',
          signup_attribution_sessionId: 'test-session-123',
          ms_since_summary_view: expect.any(Number),
        })
      );

      // Verify attribution marker was cleared after success
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('signup_attribution_source');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('signup_attribution_variant');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('signup_attribution_sessionId');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('signup_attribution_timestamp');
    });
  });

  test('uses default source when no attribution marker exists', async () => {
    const localStorageMock = window.localStorage as unknown as {
      getItem: jest.Mock;
    };

    localStorageMock.getItem.mockReturnValue(null);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', guestUpgraded: false, sessionsTransferred: 0 }),
    });

    render(<SignupPage />);
    await userEvent.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      // Verify signup_attempt uses default source
      expect(captureMock).toHaveBeenCalledWith(
        'signup_attempt',
        expect.objectContaining({
          source: 'signup_page',
        })
      );

      // Should not include attribution properties
      const signupAttemptCall = captureMock.mock.calls.find(
        (call: unknown[]) => Array.isArray(call) && call[0] === 'signup_attempt'
      );
      expect(signupAttemptCall[1]).not.toHaveProperty('signup_attribution_source');
    });
  });

  test('handles localStorage errors gracefully', async () => {
    const localStorageMock = window.localStorage as unknown as {
      getItem: jest.Mock;
    };

    // Simulate localStorage error
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', guestUpgraded: false, sessionsTransferred: 0 }),
    });

    // Should not throw and should use default source
    render(<SignupPage />);
    await userEvent.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(captureMock).toHaveBeenCalledWith('signup_attempt', expect.any(Object));
      expect(captureMock).toHaveBeenCalledWith('signup_success', expect.any(Object));
    });
  });
});
