/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { ReadinessSnapshotCard } from "@/components/dashboard/ReadinessSnapshotCard";
import { getExamReadinessTier } from "@/lib/readiness";

describe("ReadinessSnapshotCard", () => {
  it("renders readiness score in circular indicator", () => {
    render(
      <ReadinessSnapshotCard
        score={71}
        hasCompletedDiagnostic={true}
        overallAccuracy={71}
        blueprintCoverage={65}
      />
    );

    expect(screen.getByText("71")).toBeInTheDocument();
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
    expect(screen.getByText("71%")).toBeInTheDocument();
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

  it("renders insight text with weakest domain", () => {
    render(
      <ReadinessSnapshotCard
        score={71}
        hasCompletedDiagnostic={true}
        overallAccuracy={71}
        blueprintCoverage={65}
        weakestDomain="Risk Management"
        weakestDomainWeight={20}
      />
    );

    expect(screen.getAllByText(/Risk Management/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/20%/i)).toBeInTheDocument();
  });

  it("links to practice for weakest domain", () => {
    render(
      <ReadinessSnapshotCard
        score={71}
        hasCompletedDiagnostic={true}
        overallAccuracy={71}
        blueprintCoverage={65}
        weakestDomain="Risk Management"
        weakestDomainWeight={20}
      />
    );

    const practiceLink = screen.getByRole("link", { name: /Practice Risk Management/i });
    expect(practiceLink).toBeInTheDocument();
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

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText(/Get started/i)).toBeInTheDocument();
  });
});

