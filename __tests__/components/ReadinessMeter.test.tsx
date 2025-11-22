/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadinessMeter } from "@/components/dashboard/ReadinessMeter";
import { getExamReadinessTier } from "@/lib/readiness";

describe("ReadinessMeter", () => {
  it("should display score and tier when hasCompletedDiagnostic is true", () => {
    const score = 80;
    const tier = getExamReadinessTier(score);

    render(
      <ReadinessMeter
        score={score}
        hasCompletedDiagnostic={true}
        lastDiagnosticDate="2024-01-15T10:00:00Z"
        lastDiagnosticSessionId="session-123"
      />
    );

    // Check that score is displayed
    expect(screen.getByText("80%")).toBeInTheDocument();

    // Check that tier label is displayed
    expect(screen.getByText(tier.label)).toBeInTheDocument();

    // Check that description is displayed
    expect(screen.getByText(tier.description)).toBeInTheDocument();

    // Check that explanatory text is displayed
    expect(screen.getByText(/Based on your latest diagnostic/i)).toBeInTheDocument();

    // Check that date is formatted and displayed
    expect(screen.getByText(/Jan 15, 2024/i)).toBeInTheDocument();
  });

  it("should display View results link when lastDiagnosticSessionId is provided", () => {
    const sessionId = "session-123";

    render(
      <ReadinessMeter
        score={80}
        hasCompletedDiagnostic={true}
        lastDiagnosticDate="2024-01-15T10:00:00Z"
        lastDiagnosticSessionId={sessionId}
      />
    );

    const viewResultsLink = screen.getByRole("link", { name: /View results/i });
    expect(viewResultsLink).toBeInTheDocument();
    expect(viewResultsLink).toHaveAttribute("href", `/diagnostic/${sessionId}/summary`);
  });

  it("should not display View results link when lastDiagnosticSessionId is not provided", () => {
    render(
      <ReadinessMeter
        score={80}
        hasCompletedDiagnostic={true}
        lastDiagnosticDate="2024-01-15T10:00:00Z"
      />
    );

    expect(screen.queryByRole("link", { name: /View results/i })).not.toBeInTheDocument();
  });

  it("should display empty state when hasCompletedDiagnostic is false", () => {
    render(
      <ReadinessMeter
        score={0}
        hasCompletedDiagnostic={false}
        onStartDiagnostic={jest.fn()}
      />
    );

    // Check that 0% is displayed (there are multiple instances, so use getAllByText)
    const zeroPercentElements = screen.getAllByText("0%");
    expect(zeroPercentElements.length).toBeGreaterThan(0);

    // Check that "Get started" label is displayed
    expect(screen.getByText("Get started")).toBeInTheDocument();

    // Check that empty state description is displayed
    expect(screen.getByText(/Take your first PMLE diagnostic to see your readiness score/i)).toBeInTheDocument();

    // Check that CTA button is displayed
    expect(screen.getByRole("button", { name: /Take your first diagnostic/i })).toBeInTheDocument();
  });

  it("should call onStartDiagnostic when empty state CTA is clicked", async () => {
    const user = userEvent.setup();
    const onStartDiagnostic = jest.fn();

    render(
      <ReadinessMeter
        score={0}
        hasCompletedDiagnostic={false}
        onStartDiagnostic={onStartDiagnostic}
      />
    );

    const ctaButton = screen.getByRole("button", { name: /Take your first diagnostic/i });
    await user.click(ctaButton);

    expect(onStartDiagnostic).toHaveBeenCalledTimes(1);
  });

  it("should not display CTA button when onStartDiagnostic is not provided in empty state", () => {
    render(
      <ReadinessMeter
        score={0}
        hasCompletedDiagnostic={false}
      />
    );

    expect(screen.queryByRole("button", { name: /Take your first diagnostic/i })).not.toBeInTheDocument();
  });

  it("should display correct tier for different score ranges", () => {
    const testCases = [
      { score: 30, expectedTier: "Low" },
      { score: 50, expectedTier: "Building" },
      { score: 75, expectedTier: "Ready" },
      { score: 90, expectedTier: "Strong" },
    ];

    testCases.forEach(({ score, expectedTier }) => {
      const { unmount } = render(
        <ReadinessMeter
          score={score}
          hasCompletedDiagnostic={true}
          lastDiagnosticDate="2024-01-15T10:00:00Z"
        />
      );

      expect(screen.getByText(expectedTier)).toBeInTheDocument();
      expect(screen.getByText(`${score}%`)).toBeInTheDocument();

      unmount();
    });
  });

  it("should handle missing lastDiagnosticDate gracefully", () => {
    render(
      <ReadinessMeter
        score={80}
        hasCompletedDiagnostic={true}
        lastDiagnosticSessionId="session-123"
      />
    );

    // Should still show explanatory text
    expect(screen.getByText(/Based on your latest diagnostic/i)).toBeInTheDocument();

    // Should not show date
    expect(screen.queryByText(/Jan/i)).not.toBeInTheDocument();
  });

  it("should apply className prop correctly", () => {
    const { container } = render(
      <ReadinessMeter
        score={80}
        hasCompletedDiagnostic={true}
        className="custom-class"
      />
    );

    const card = container.querySelector(".custom-class");
    expect(card).toBeInTheDocument();
  });
});

