/** @jest-environment jsdom */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock PostHog
const captureMock = jest.fn();
const mockPostHog = { capture: captureMock };
jest.mock("posthog-js/react", () => ({
  usePostHog: () => mockPostHog,
}));

// Mock Supabase client
const updateUserMock = jest.fn();
const verifyOtpMock = jest.fn();
jest.mock("../lib/supabase/client", () => ({
  supabase: {
    auth: {
      updateUser: updateUserMock,
      verifyOtp: verifyOtpMock,
    },
  },
}));

// Import after mocks
import ResetPasswordPage from "../app/reset-password/page";

const mockPush = jest.fn();

beforeEach(() => {
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
  });
  updateUserMock.mockReset();
  verifyOtpMock.mockReset();
  window.history.replaceState({}, "", "/reset-password?token_hash=valid-token-123&type=recovery");
  verifyOtpMock.mockResolvedValue({ data: { session: { user: { id: "test-user" } } }, error: null });
  captureMock.mockClear();
  mockPush.mockClear();
});

describe("ResetPasswordPage", () => {
  test("renders reset password form with valid token", async () => {
    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    // Wait for the form to appear after session check
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /reset your password/i })).toBeInTheDocument();
    });

    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: "valid-token-123", type: "recovery" });
    expect(screen.getByPlaceholderText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^confirm new password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reset password$/i })).toBeInTheDocument();
  });

  test("shows error when token is missing", async () => {
    window.history.replaceState({}, "", "/reset-password");

    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /password reset failed/i });

    expect(screen.getByText(/Password Reset Failed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request new link/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/^new password$/i)).not.toBeInTheDocument();
  });

  test("shows validation errors for empty form submission", async () => {
    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    await userEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  test("shows validation error for short password", async () => {
    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), "short");
    await userEvent.type(screen.getByPlaceholderText(/^confirm new password$/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  test("shows validation error for password mismatch", async () => {
    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), "password123");
    await userEvent.type(screen.getByPlaceholderText(/^confirm new password$/i), "different123");
    await userEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument();
  });

  test("successfully updates password and redirects to login", async () => {
    updateUserMock.mockResolvedValue({ error: null });

    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), "newpassword123");
    await userEvent.type(screen.getByPlaceholderText(/^confirm new password$/i), "newpassword123");
    await userEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        password: "newpassword123",
      });
    });

    expect(captureMock).toHaveBeenCalledWith("password_reset_success");
    expect(await screen.findByText(/password reset successfully/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /go to login now/i }));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  test("shows loading state during password update", async () => {
    updateUserMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
    );

    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), "newpassword123");
    await userEvent.type(screen.getByPlaceholderText(/^confirm new password$/i), "newpassword123");
    await userEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(screen.getByText(/resetting/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resetting/i })).toBeDisabled();
  });

  test("handles Supabase errors gracefully", async () => {
    updateUserMock.mockResolvedValue({
      error: new Error("Invalid or expired reset token"),
    });

    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), "newpassword123");
    await userEvent.type(screen.getByPlaceholderText(/^confirm new password$/i), "newpassword123");
    await userEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(await screen.findByText(/invalid or expired reset token/i)).toBeInTheDocument();

    expect(captureMock).toHaveBeenCalledWith("password_reset_submit_error", {
      error_message: "Invalid or expired reset token",
    });
  });

  test("handles network errors", async () => {
    updateUserMock.mockRejectedValue(new Error("Network error"));

    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), "newpassword123");
    await userEvent.type(screen.getByPlaceholderText(/^confirm new password$/i), "newpassword123");
    await userEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

  test("prevents multiple form submissions", async () => {
    updateUserMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
    );

    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), "newpassword123");
    await userEvent.type(screen.getByPlaceholderText(/^confirm new password$/i), "newpassword123");

    const submitButton = screen.getByRole("button", { name: /^reset password$/i });

    // Click multiple times
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);
    await userEvent.click(submitButton);

    // Should only make one API call
    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledTimes(1);
    });
  });

  // TODO(revival): unbuilt feature — keep or delete? Live password strength feedback is not implemented.
  describe.skip("Password strength feedback", () => {
    test("shows password strength indicator", async () => {
      render(<ResetPasswordPage />);

      await screen.findByRole("heading", { name: /reset your password/i });

      const passwordInput = screen.getByPlaceholderText(/^new password$/i);

      // Type weak password
      await userEvent.type(passwordInput, "weak");
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();

      // Type strong password
      await userEvent.clear(passwordInput);
      await userEvent.type(passwordInput, "StrongPassword123!");
      expect(screen.queryByText(/password must be at least 8 characters/i)).not.toBeInTheDocument();
    });
  });

  test("maintains accessibility standards", async () => {
    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    const passwordInput = screen.getByPlaceholderText(/^new password$/i);
    const confirmInput = screen.getByPlaceholderText(/^confirm new password$/i);

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveAttribute("autoComplete", "new-password");
    expect(passwordInput).toHaveAttribute("aria-required", "true");

    expect(confirmInput).toHaveAttribute("type", "password");
    expect(confirmInput).toHaveAttribute("autoComplete", "new-password");
    expect(confirmInput).toHaveAttribute("aria-required", "true");

    const submitButton = screen.getByRole("button", { name: /^reset password$/i });
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  test("clears validation errors when user starts typing", async () => {
    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    // Trigger validation error
    await userEvent.click(screen.getByRole("button", { name: /^reset password$/i }));
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();

    // Start typing - error should clear
    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), "password123");
    expect(screen.queryByText(/password must be at least 8 characters/i)).not.toBeInTheDocument();
  });

  test("provides link to request new reset when token is invalid", async () => {
    window.history.replaceState({}, "", "/reset-password");

    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /password reset failed/i });

    const resetLink = screen.getByRole("button", { name: /request new link/i });
    await userEvent.click(resetLink);
    expect(mockPush).toHaveBeenCalledWith("/forgot-password");
  });

  test("shows appropriate error message structure", async () => {
    updateUserMock.mockResolvedValue({
      error: new Error("Test error message"),
    });

    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /reset your password/i });

    await userEvent.type(screen.getByPlaceholderText(/^new password$/i), "newpassword123");
    await userEvent.type(screen.getByPlaceholderText(/^confirm new password$/i), "newpassword123");
    await userEvent.click(screen.getByRole("button", { name: /^reset password$/i }));

    const errorElement = await screen.findByRole("alert");
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveAttribute("aria-live", "assertive");
    expect(errorElement).toHaveTextContent(/test error message/i);
  });

  test("handles token validation on component mount", async () => {
    // Test with malformed token
    window.history.replaceState({}, "", "/reset-password?token_hash=&type=recovery");

    render(<ResetPasswordPage />);

    await screen.findByRole("heading", { name: /password reset failed/i });

    expect(screen.getByText(/Password Reset Failed/i)).toBeInTheDocument();
  });
});
