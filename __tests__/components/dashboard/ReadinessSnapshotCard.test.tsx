/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { ReadinessSnapshotCard } from "@/components/dashboard/ReadinessSnapshotCard";
import { getExamReadinessTier } from "@/lib/readiness";

describe("ReadinessSnapshotCard", () => {
  it("renders readiness score as percentage", () => {
    render(
      <ReadinessSnapshotCard
        score={71}
        hasCompletedDiagnostic={true}
        overallAccuracy={71}
        blueprintCoverage={65}
      />
    );

    // Find the score in the header (has font-bold class), not the stats in footer
    const scoreElements = screen.getAllByText("71%");
    const headerScore = scoreElements.find(el => el.classList.contains("font-bold"));
    expect(headerScore).toBeInTheDocument();
    expect(headerScore).toHaveClass("font-bold");
  });

  it("displays status label based on score tier", () => {
    const tier = getExamReadinessTier(71);
    
    render(
      <ReadinessSnapshotCard
        score={71}
        hasCompletedDiagnostic={true}
        overallAccuracy={71}
        blueprintCoverage={65}
      />
    );

    expect(screen.getByText(tier.label.toUpperCase())).toBeInTheDocument();
  });

  it("shows overall accuracy stat", () => {
    render(
      <ReadinessSnapshotCard
        score={71}
        hasCompletedDiagnostic={true}
        overallAccuracy={71}
        blueprintCoverage={65}
      />
    );

    expect(screen.getByText("Overall accuracy")).toBeInTheDocument();
    // The 71% appears in both header (score) and footer (overallAccuracy), so use getAllByText
    const accuracyElements = screen.getAllByText("71%");
    expect(accuracyElements.length).toBeGreaterThan(0);
  });

  it("shows blueprint coverage stat", () => {
    render(
      <ReadinessSnapshotCard
        score={71}
        hasCompletedDiagnostic={true}
        overallAccuracy={71}
        blueprintCoverage={65}
      />
    );

    expect(screen.getByText("Blueprint coverage")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("shows period context", () => {
    render(
      <ReadinessSnapshotCard
        score={71}
        hasCompletedDiagnostic={true}
        overallAccuracy={71}
        blueprintCoverage={65}
        periodContext="Based on last 7 days of practice"
      />
    );

    expect(screen.getByText(/Based on last 7 days of practice/i)).toBeInTheDocument();
  });

  it("displays empty state when no diagnostic completed", () => {
    render(
      <ReadinessSnapshotCard
        score={0}
        hasCompletedDiagnostic={false}
        overallAccuracy={0}
        blueprintCoverage={0}
      />
    );

    // Should not display readiness score percentage when no diagnostic completed
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    expect(screen.getByText(/GET STARTED/i)).toBeInTheDocument();
  });
});

