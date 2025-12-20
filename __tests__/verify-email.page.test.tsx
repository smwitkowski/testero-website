import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import VerifyEmailPage from "../app/verify-email/page";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("posthog-js/react", () => ({
  usePostHog: jest.fn(),
}));

jest.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
    },
  },
}));

jest.mock("@/lib/analytics/analytics", () => ({
  ...jest.requireActual("@/lib/analytics/analytics"),
  trackEvent: jest.fn(),
  trackError: jest.fn(),
  identifyUser: jest.fn(),
}));

jest.mock("@/lib/analytics/funnels", () => ({
  ...jest.requireActual("@/lib/analytics/funnels"),
  trackActivationFunnel: jest.fn(),
}));

// Mock fetch for session endpoint
global.fetch = jest.fn();

const mockRouter = {
  push: jest.fn(),
};

const mockPostHog = {
  capture: jest.fn(),
};

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (usePostHog as jest.Mock).mockReturnValue(mockPostHog);
    (global.fetch as jest.Mock).mockClear();

    // Mock window.location.hash
    Object.defineProperty(window, "location", {
      value: {
        hash: "",
      },
      writable: true,
    });
  });

  test("shows loading state initially", async () => {
    // Set up a valid hash so it doesn't immediately error out
    window.location.hash = "#access_token=valid_token&refresh_token=refresh_token";

    const { supabase } = require("@/lib/supabase/client");

    // Mock a pending promise to keep the component in loading state
    let resolvePromise: any;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    supabase.auth.setSession.mockReturnValue(pendingPromise);

    render(<VerifyEmailPage />);

    // Component should start in loading state
    expect(screen.getByText("Verifying Your Email")).toBeInTheDocument();
    expect(
      screen.getByText("Please wait while we confirm your email address...")
    ).toBeInTheDocument();
    expect(screen.getByText("Confirming your email address...")).toBeInTheDocument();

    // Clean up by resolving the promise
    resolvePromise({
      data: { session: null, user: null },
      error: { message: "Test cleanup" },
    });
  });

  test("shows error state when no access token in URL and no authenticated session", async () => {
    const { trackEvent, trackError } = require("@/lib/analytics/analytics");
    window.location.hash = "";

    // Mock session endpoint to return no user
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: null }),
    });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Verification Failed" })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("There was a problem verifying your email")).toBeInTheDocument();
    expect(screen.getByText("No verification token found in URL")).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalled();
    expect(trackError).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/session");
  });

  test("shows error state when Supabase setSession fails", async () => {
    const { supabase } = require("@/lib/supabase/client");
    const { trackEvent, trackError } = require("@/lib/analytics/analytics");

    window.location.hash = "#access_token=valid_token&refresh_token=refresh_token";

    // Mock Supabase setSession to reject with an Error
    supabase.auth.setSession.mockRejectedValue(new Error("Invalid token"));

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Verification Failed" })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("There was a problem verifying your email")).toBeInTheDocument();
    expect(screen.getByText("Invalid token")).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalled();
    expect(trackError).toHaveBeenCalled();
  });

  test("shows success state and redirects when verification succeeds", async () => {
    const { supabase } = require("@/lib/supabase/client");
    const { trackEvent, identifyUser } = require("@/lib/analytics/analytics");
    const { trackActivationFunnel } = require("@/lib/analytics/funnels");

    window.location.hash = "#access_token=valid_token&refresh_token=refresh_token";

    // Mock successful Supabase setSession
    supabase.auth.setSession.mockResolvedValue({
      data: {
        session: { user: { id: "user123", email: "test@example.com" } },
        user: { id: "user123", email: "test@example.com" },
      },
      error: null,
    });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText("Email Verified!")).toBeInTheDocument();
    });

    expect(screen.getByText("Your account has been successfully verified")).toBeInTheDocument();
    expect(screen.getByText("Welcome to Testero!")).toBeInTheDocument();
    expect(screen.getByText("Continue to Dashboard")).toBeInTheDocument();

    expect(trackEvent).toHaveBeenCalled();
    expect(identifyUser).toHaveBeenCalled();
    expect(trackActivationFunnel).toHaveBeenCalled();

    // Check that auto-redirect is set up (we can't easily test the setTimeout, but we can check the initial state)
    expect(
      screen.getByText("You'll be automatically redirected to your dashboard in a few seconds.")
    ).toBeInTheDocument();
  });

  test("tracks page view event on mount", () => {
    const { trackEvent } = require("@/lib/analytics/analytics");
    render(<VerifyEmailPage />);

    expect(trackEvent).toHaveBeenCalled();
  });

  test("handles missing refresh token gracefully", async () => {
    const { supabase } = require("@/lib/supabase/client");

    window.location.hash = "#access_token=valid_token";

    // Mock successful Supabase setSession
    supabase.auth.setSession.mockResolvedValue({
      data: {
        session: { user: { id: "user123", email: "test@example.com" } },
        user: { id: "user123", email: "test@example.com" },
      },
      error: null,
    });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText("Email Verified!")).toBeInTheDocument();
    });

    // Verify setSession was called with empty string for refresh_token when not provided
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: "valid_token",
      refresh_token: "",
    });
  });

  test("shows success state for PKCE flow when session endpoint returns authenticated user", async () => {
    const { trackEvent, identifyUser } = require("@/lib/analytics/analytics");
    const { trackActivationFunnel } = require("@/lib/analytics/funnels");

    window.location.hash = "";

    // Mock session endpoint to return authenticated user (PKCE flow)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          id: "user123",
          email: "test@example.com",
          email_confirmed_at: "2025-12-16T13:09:44.290183Z",
        },
      }),
    });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText("Email Verified!")).toBeInTheDocument();
    });

    expect(screen.getByText("Your account has been successfully verified")).toBeInTheDocument();
    expect(screen.getByText("Welcome to Testero!")).toBeInTheDocument();
    expect(screen.getByText("Continue to Dashboard")).toBeInTheDocument();

    expect(trackEvent).toHaveBeenCalled();
    expect(identifyUser).toHaveBeenCalledWith(
      mockPostHog,
      "user123",
      expect.objectContaining({
        email: "test@example.com",
        email_verified: true,
      })
    );
    expect(trackActivationFunnel).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/session");
  });

  test("shows error state for PKCE flow when session endpoint returns unconfirmed user", async () => {
    const { trackEvent, trackError } = require("@/lib/analytics/analytics");

    window.location.hash = "";

    // Mock session endpoint to return user without email_confirmed_at
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          id: "user123",
          email: "test@example.com",
          email_confirmed_at: null,
        },
      }),
    });

    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Verification Failed" })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("There was a problem verifying your email")).toBeInTheDocument();
    expect(screen.getByText("No verification token found in URL")).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalled();
    expect(trackError).toHaveBeenCalled();
  });
});
