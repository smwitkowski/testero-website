import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePostHog } from "posthog-js/react";
import { usePathname, useRouter } from "next/navigation";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { resetMockRouter } from "@/__tests__/test-utils/mockNextNavigation";
import { useStartBasicCheckout } from "@/hooks/useStartBasicCheckout";

// Mock PostHog
jest.mock("posthog-js/react", () => ({
  usePostHog: jest.fn(),
}));

// Mock next/navigation (override global mock for pathname control)
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock useStartBasicCheckout
jest.mock("@/hooks/useStartBasicCheckout", () => ({
  useStartBasicCheckout: jest.fn(),
}));

const mockPostHog = {
  capture: jest.fn(),
  get_distinct_id: jest.fn(() => "did-123"),
};

const mockRouter = {
  push: jest.fn(),
};

const mockStartBasicCheckout = jest.fn();

describe("UpgradePrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePostHog as jest.Mock).mockReturnValue(mockPostHog);
    (usePathname as jest.Mock).mockReturnValue("/practice");
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useStartBasicCheckout as jest.Mock).mockReturnValue({
      startBasicCheckout: mockStartBasicCheckout,
    });
    resetMockRouter({ pathname: "/practice" });
  });

  it("renders a Dialog open by default with correct title and body", () => {
    render(<UpgradePrompt featureName="practice" />);

    expect(screen.getByText("Unlock PMLE Pass")).toBeInTheDocument();
    expect(
      screen.getByText(
        "US$39 once for 90 days of full PMLE practice and explanations. No subscription or automatic renewal."
      )
    ).toBeInTheDocument();
  });

  it("fires gate_viewed once on first render with correct properties", () => {
    render(<UpgradePrompt featureName="practice" />);

    expect(mockPostHog.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.GATE_VIEWED,
      expect.objectContaining({
        route: "/practice",
        distinct_id: "did-123",
        feature: "practice",
      })
    );
    expect(mockPostHog.capture).toHaveBeenCalledTimes(1);
  });

  it("fires gate_viewed with 'unknown' feature when featureName is not provided", () => {
    render(<UpgradePrompt />);

    expect(mockPostHog.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.GATE_VIEWED,
      expect.objectContaining({
        route: "/practice",
        distinct_id: "did-123",
        feature: "unknown",
      })
    );
  });

  it("does not fire gate_viewed multiple times on re-render", () => {
    const { rerender } = render(<UpgradePrompt featureName="practice" />);

    expect(mockPostHog.capture).toHaveBeenCalledTimes(1);

    rerender(<UpgradePrompt featureName="practice" />);

    // Should still be called only once
    expect(mockPostHog.capture).toHaveBeenCalledTimes(1);
  });

  it("captures gate_cta_clicked and starts checkout when primary CTA is clicked", async () => {
    const user = userEvent.setup();
    render(<UpgradePrompt featureName="practice" />);

    const primaryButton = screen.getByRole("button", {
      name: /get pmle pass/i,
    });
    await user.click(primaryButton);

    expect(mockPostHog.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.GATE_CTA_CLICKED,
      expect.objectContaining({
        route: "/practice",
        plan_context: "PMLE Pass",
        plan_name: "PMLE Pass",
        feature: "practice",
      })
    );
    expect(mockStartBasicCheckout).toHaveBeenCalledWith("upgrade_prompt_practice");
  });

  it("captures gate_dismissed and closes modal when secondary CTA is clicked", async () => {
    const user = userEvent.setup();
    render(<UpgradePrompt featureName="practice" />);

    const dismissButton = screen.getByRole("button", {
      name: /dismiss/i,
    });
    await user.click(dismissButton);

    expect(mockPostHog.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.GATE_DISMISSED,
      expect.objectContaining({
        route: "/practice",
        feature: "practice",
      })
    );
  });

  it("includes featureName in all analytics event payloads", async () => {
    const user = userEvent.setup();
    render(<UpgradePrompt featureName="study_path" />);

    // Check gate_viewed includes feature
    expect(mockPostHog.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.GATE_VIEWED,
      expect.objectContaining({
        feature: "study_path",
      })
    );

    // Check gate_cta_clicked includes feature
    const primaryButton = screen.getByRole("button", {
      name: /get pmle pass/i,
    });
    await user.click(primaryButton);

    expect(mockPostHog.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.GATE_CTA_CLICKED,
      expect.objectContaining({
        feature: "study_path",
      })
    );

    // Reset for dismiss test
    mockPostHog.capture.mockClear();

    const dismissButton = screen.getByRole("button", {
      name: /dismiss/i,
    });
    await user.click(dismissButton);

    expect(mockPostHog.capture).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.GATE_DISMISSED,
      expect.objectContaining({
        feature: "study_path",
      })
    );
  });

  it("states refund revocation, not a trial or cancel-anytime offer", () => {
    render(<UpgradePrompt />);
    expect(screen.getByText("7-day refund window. A refund ends pass access.")).toBeInTheDocument();
    expect(screen.queryByText(/cancel anytime|trial/i)).not.toBeInTheDocument();
  });

  it("handles missing PostHog gracefully", () => {
    (usePostHog as jest.Mock).mockReturnValue(null);

    expect(() => {
      render(<UpgradePrompt featureName="practice" />);
    }).not.toThrow();

    expect(screen.getByText("Unlock PMLE Pass")).toBeInTheDocument();
  });
});

