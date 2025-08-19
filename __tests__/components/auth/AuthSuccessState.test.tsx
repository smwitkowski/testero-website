/** @jest-environment jsdom */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthSuccessState } from "@/components/auth/states/AuthSuccessState";

// Mock useRouter
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("AuthSuccessState", () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("renders success icon and message", () => {
    render(<AuthSuccessState />);

    // Should render the default title and message
    expect(screen.getByText("Success!")).toBeInTheDocument();
    expect(screen.getByText("Operation completed successfully.")).toBeInTheDocument();

    // Should render the success icon
    expect(screen.getByRole("img", { name: /success/i })).toBeInTheDocument();
  });

  test("renders custom title and message", () => {
    render(
      <AuthSuccessState
        title="Password Updated!"
        message="Your password has been successfully changed."
      />
    );

    expect(screen.getByText("Password Updated!")).toBeInTheDocument();
    expect(screen.getByText("Your password has been successfully changed.")).toBeInTheDocument();
  });

  test("handles auto-redirect with countdown", async () => {
    render(<AuthSuccessState redirectPath="/dashboard" autoRedirect={true} redirectDelay={3000} />);

    // Should show countdown message
    expect(screen.getByText(/redirecting in 3 seconds/i)).toBeInTheDocument();

    // Fast-forward time by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Should update countdown
    expect(screen.getByText(/redirecting in 2 seconds/i)).toBeInTheDocument();

    // Fast-forward to redirect time
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should trigger redirect
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  test("calls manual redirect action", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <AuthSuccessState
        redirectPath="/dashboard"
        actionButton={{
          text: "Continue to Dashboard",
          action: "redirect",
        }}
      />
    );

    const button = screen.getByRole("button", { name: /continue to dashboard/i });
    await user.click(button);

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  test("handles custom action buttons", async () => {
    const customAction = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    render(
      <AuthSuccessState
        actionButton={{
          text: "Custom Action",
          action: customAction,
        }}
      />
    );

    const button = screen.getByRole("button", { name: /custom action/i });
    await user.click(button);

    expect(customAction).toHaveBeenCalled();
  });

  test("tracks analytics events", () => {
    const mockTrackEvent = jest.fn();

    render(<AuthSuccessState onMount={() => mockTrackEvent("success_page_viewed")} />);

    expect(mockTrackEvent).toHaveBeenCalledWith("success_page_viewed");
  });

  test("cancels redirect timer on unmount", () => {
    const { unmount } = render(
      <AuthSuccessState redirectPath="/dashboard" autoRedirect={true} redirectDelay={5000} />
    );

    // Verify timer is set
    expect(screen.getByText(/redirecting in 5 seconds/i)).toBeInTheDocument();

    // Unmount component
    unmount();

    // Fast-forward past redirect time
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    // Should not trigger redirect
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("disables auto-redirect when autoRedirect is false", () => {
    render(
      <AuthSuccessState redirectPath="/dashboard" autoRedirect={false} redirectDelay={1000} />
    );

    // Should not show countdown
    expect(screen.queryByText(/redirecting/i)).not.toBeInTheDocument();

    // Fast-forward past redirect time
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should not redirect
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("applies custom className", () => {
    render(<AuthSuccessState className="custom-success-class" />);

    const container = screen.getByRole("img", { name: /success/i }).closest(".text-center");
    expect(container).toHaveClass("custom-success-class");
  });

  test("handles accessibility attributes", () => {
    render(<AuthSuccessState title="Email Verified" />);

    // Should have proper aria attributes
    const successIcon = screen.getByRole("img", { name: /success/i });
    expect(successIcon).toBeInTheDocument();

    // Should have heading structure
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });
});
