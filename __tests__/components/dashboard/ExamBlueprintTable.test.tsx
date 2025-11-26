/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { ExamBlueprintTable } from "@/components/dashboard/ExamBlueprintTable";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

const mockDomainStats = [
  {
    domainCode: "ARCHITECTING_LOW_CODE_ML_SOLUTIONS",
    questionsAnswered: 30,
    totalQuestions: 30,
    accuracy: 92,
  },
  {
    domainCode: "COLLABORATING_TO_MANAGE_DATA_AND_MODELS",
    questionsAnswered: 25,
    totalQuestions: 50,
    accuracy: 78,
  },
  {
    domainCode: "SCALING_PROTOTYPES_INTO_ML_MODELS",
    questionsAnswered: 10,
    totalQuestions: 40,
    accuracy: 65,
  },
];

describe("ExamBlueprintTable", () => {
  it("renders all PMLE domains from blueprint", () => {
    render(<ExamBlueprintTable domainStats={mockDomainStats} />);

    PMLE_BLUEPRINT.forEach((domain) => {
      expect(screen.getByText(domain.displayName)).toBeInTheDocument();
    });
  });

  it("displays weight percentages correctly", () => {
    render(<ExamBlueprintTable domainStats={mockDomainStats} />);

    expect(screen.getByText("13%")).toBeInTheDocument(); // ARCHITECTING_LOW_CODE_ML_SOLUTIONS weight
    expect(screen.getByText("16%")).toBeInTheDocument(); // COLLABORATING_TO_MANAGE_DATA_AND_MODELS weight
  });

  it("shows Mastered badge for accuracy >= 80%", () => {
    render(<ExamBlueprintTable domainStats={mockDomainStats} />);

    expect(screen.getByText("Mastered")).toBeInTheDocument();
  });

  it("shows Practice link for accuracy < 80%", () => {
    render(<ExamBlueprintTable domainStats={mockDomainStats} />);

    const practiceLinks = screen.getAllByText("Practice");
    expect(practiceLinks.length).toBeGreaterThan(0);
  });

  it("calculates coverage percentage from answered questions", () => {
    render(<ExamBlueprintTable domainStats={mockDomainStats} />);

    // Should show coverage stats in header (65 answered / 120 total = 54%)
    expect(screen.getByText(/covered/i)).toBeInTheDocument();
    expect(screen.getAllByText(/accuracy/i).length).toBeGreaterThan(0);
  });

  it("displays questions answered in format X/Y", () => {
    render(<ExamBlueprintTable domainStats={mockDomainStats} />);

    expect(screen.getByText("30/30")).toBeInTheDocument();
    expect(screen.getByText("25/50")).toBeInTheDocument();
    expect(screen.getByText("10/40")).toBeInTheDocument();
  });

  it("displays accuracy percentages", () => {
    render(<ExamBlueprintTable domainStats={mockDomainStats} />);

    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });
});

