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
