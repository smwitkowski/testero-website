/** @jest-environment jsdom */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthErrorState } from "@/components/auth/states/AuthErrorState";

// Mock useRouter
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("AuthErrorState", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  test("renders error icon and message", () => {
    render(<AuthErrorState />);

    // Should render the default title and message
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();

    // Should render the error icon
    expect(screen.getByRole("img", { name: /error/i })).toBeInTheDocument();
  });

  test("renders custom title and message", () => {
    render(
      <AuthErrorState
        title="Verification Failed"
        message="The verification token is invalid or has expired."
      />
    );

    expect(screen.getByText("Verification Failed")).toBeInTheDocument();
    expect(
      screen.getByText("The verification token is invalid or has expired.")
    ).toBeInTheDocument();
  });

  test("handles retry action", async () => {
    const mockRetry = jest.fn();
    const user = userEvent.setup();

    render(<AuthErrorState onRetry={mockRetry} retryButtonText="Try Again" />);

    const retryButton = screen.getByRole("button", { name: /try again/i });
    await user.click(retryButton);

    expect(mockRetry).toHaveBeenCalled();
  });

  test("handles redirect action", async () => {
    const user = userEvent.setup();

    render(<AuthErrorState redirectPath="/login" redirectButtonText="Back to Login" />);

    const redirectButton = screen.getByRole("button", { name: /back to login/i });
    await user.click(redirectButton);

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  test("renders both retry and redirect buttons", async () => {
    const mockRetry = jest.fn();
    const user = userEvent.setup();

    render(
      <AuthErrorState
        onRetry={mockRetry}
        retryButtonText="Retry"
        redirectPath="/signup"
        redirectButtonText="Back to Signup"
      />
    );

    // Both buttons should be present
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to signup/i })).toBeInTheDocument();

    // Test retry functionality
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(mockRetry).toHaveBeenCalled();

    // Test redirect functionality
    await user.click(screen.getByRole("button", { name: /back to signup/i }));
    expect(mockPush).toHaveBeenCalledWith("/signup");
  });

  test("tracks analytics events", () => {
    const mockTrackEvent = jest.fn();

    render(<AuthErrorState onMount={() => mockTrackEvent("error_page_viewed")} />);

    expect(mockTrackEvent).toHaveBeenCalledWith("error_page_viewed");
  });

  test("renders error details when provided", () => {
    render(
      <AuthErrorState
        title="Network Error"
        message="Unable to connect to server."
        errorDetails="Connection timeout after 30 seconds"
      />
    );

    expect(screen.getByText("Network Error")).toBeInTheDocument();
    expect(screen.getByText("Unable to connect to server.")).toBeInTheDocument();
    expect(screen.getByText("Connection timeout after 30 seconds")).toBeInTheDocument();
  });

  test("applies custom className", () => {
    render(<AuthErrorState className="custom-error-class" />);

    const container = screen.getByRole("img", { name: /error/i }).closest(".text-center");
    expect(container).toHaveClass("custom-error-class");
  });

  test("handles accessibility attributes", () => {
    render(<AuthErrorState title="Authentication Failed" />);

    // Should have proper aria attributes
    const errorIcon = screen.getByRole("img", { name: /error/i });
    expect(errorIcon).toBeInTheDocument();

    // Should have heading structure
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  test("supports different error types", () => {
    render(
      <AuthErrorState
        errorType="network"
        title="Connection Failed"
        message="Please check your internet connection."
      />
    );

    expect(screen.getByText("Connection Failed")).toBeInTheDocument();
    expect(screen.getByText("Please check your internet connection.")).toBeInTheDocument();
  });

  test("displays only retry button when no redirect provided", () => {
    const mockRetry = jest.fn();

    render(<AuthErrorState onRetry={mockRetry} retryButtonText="Try Again" />);

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/back to/i)).not.toBeInTheDocument();
  });

  test("displays only redirect button when no retry provided", () => {
    render(
      <AuthErrorState
        redirectPath="/login"
        redirectButtonText="Back to Login"
        message="An error occurred."
      />
    );

    expect(screen.getByRole("button", { name: /back to login/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });
});
