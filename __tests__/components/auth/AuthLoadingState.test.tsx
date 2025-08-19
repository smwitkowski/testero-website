/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { AuthLoadingState } from "@/components/auth/states/AuthLoadingState";

describe("AuthLoadingState", () => {
  test("renders loading spinner with default message", () => {
    render(<AuthLoadingState />);

    // Should render the default title and message
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText("Please wait...")).toBeInTheDocument();

    // Should render the loading spinner with proper accessibility
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading: Loading")).toBeInTheDocument();
  });

  test("renders custom title and message", () => {
    render(
      <AuthLoadingState
        title="Verifying Your Token"
        message="Please wait while we verify your reset token..."
      />
    );

    expect(screen.getByText("Verifying Your Token")).toBeInTheDocument();
    expect(screen.getByText("Please wait while we verify your reset token...")).toBeInTheDocument();
  });

  test("uses different spinner sizes", () => {
    const { rerender } = render(<AuthLoadingState size="sm" />);

    // Check small spinner is rendered inside the status container
    let statusContainer = screen.getByRole("status");
    let svg = statusContainer.querySelector("svg");
    expect(svg).toHaveClass("h-4", "w-4");

    // Test medium size (default)
    rerender(<AuthLoadingState size="md" />);
    statusContainer = screen.getByRole("status");
    svg = statusContainer.querySelector("svg");
    expect(svg).toHaveClass("h-5", "w-5");

    // Test large size
    rerender(<AuthLoadingState size="lg" />);
    statusContainer = screen.getByRole("status");
    svg = statusContainer.querySelector("svg");
    expect(svg).toHaveClass("h-6", "w-6");
  });

  test("handles accessibility attributes correctly", () => {
    render(<AuthLoadingState title="Verifying" message="Processing..." />);

    // Should have proper aria-live region
    const loadingRegion = screen.getByRole("status");
    expect(loadingRegion).toHaveAttribute("aria-live", "polite");

    // Should have proper labeling
    expect(screen.getByLabelText("Loading: Verifying")).toBeInTheDocument();
  });

  test("applies custom className", () => {
    render(<AuthLoadingState className="custom-loading-class" />);

    // The custom className should be applied to the root motion.div
    const rootContainer = screen.getByRole("status").closest(".text-center");
    expect(rootContainer).toHaveClass("custom-loading-class");
  });

  test("uses LoadingSpinner component internally", () => {
    render(<AuthLoadingState />);

    // Should render the SVG spinner with animate-spin class inside status container
    const statusContainer = screen.getByRole("status");
    const svg = statusContainer.querySelector("svg");
    expect(svg).toHaveClass("animate-spin");

    // Should have the proper SVG structure
    expect(svg?.tagName).toBe("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  test("renders with proper motion animation container", () => {
    render(<AuthLoadingState />);

    // The component should be wrapped in a motion container
    const motionContainer = screen.getByRole("status").closest(".text-center");
    expect(motionContainer).toHaveClass("text-center", "space-y-6");
  });
});
