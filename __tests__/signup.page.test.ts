/** @jest-environment jsdom */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const captureMock = jest.fn();

jest.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: captureMock }),
}));

const signUpMock = jest.fn();

jest.mock('../lib/supabase/client', () => ({
  supabase: { auth: { signUp: signUpMock } },
}));

import SignupPage from '../app/signup/page';

beforeEach(() => {
  signUpMock.mockReset();
  captureMock.mockClear();
});

test('shows validation errors for empty submission', async () => {
  render(<SignupPage />);
  const button = screen.getByRole('button', { name: /sign up/i });
  await userEvent.click(button);
  expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  expect(signUpMock).not.toHaveBeenCalled();
});

test('submits valid form and shows confirmation', async () => {
  signUpMock.mockResolvedValue({ error: null });
  render(<SignupPage />);
  await userEvent.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
  await userEvent.type(screen.getByPlaceholderText(/password/i), 'password1');
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }));
  await waitFor(() => expect(signUpMock).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password1' }));
  expect(captureMock).toHaveBeenCalledWith('signup_attempt', { email: 'test@example.com' });
  expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
});
