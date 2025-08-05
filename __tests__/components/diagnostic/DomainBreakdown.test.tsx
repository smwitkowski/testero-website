import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DomainBreakdown } from "@/components/diagnostic/DomainBreakdown";
import { DomainBreakdown as DomainBreakdownType } from "@/components/diagnostic/types";

// Mock recharts to avoid rendering issues in tests
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-domains={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, children }: any) => <div data-testid={`bar-${dataKey}`}>{children}</div>,
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
}));

describe("DomainBreakdown", () => {
  const mockDomains: DomainBreakdownType[] = [
    { domain: "Machine Learning", correct: 4, total: 5, percentage: 80 },
    { domain: "Deep Learning", correct: 2, total: 6, percentage: 33 },
    { domain: "MLOps", correct: 3, total: 4, percentage: 75 },
    { domain: "Data Engineering", correct: 1, total: 3, percentage: 33 },
  ];

  describe("Basic rendering", () => {
    it("should render bar chart with all domains", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();

      // Check that data is passed to the chart
      const barChart = screen.getByTestId("bar-chart");
      const chartData = JSON.parse(barChart.getAttribute("data-domains") || "[]");
      expect(chartData).toHaveLength(4);
    });

    it("should display correct/total for each domain", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      // Check for the score displays
      expect(screen.getByText("4/5")).toBeInTheDocument();
      expect(screen.getByText("2/6")).toBeInTheDocument();
      expect(screen.getByText("3/4")).toBeInTheDocument();
      expect(screen.getByText("1/3")).toBeInTheDocument();
    });

    it("should show section title", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      expect(screen.getByText(/score by domain/i)).toBeInTheDocument();
    });
  });

  describe("Sorting and prioritization", () => {
    it("should sort domains by score (lowest first)", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      const barChart = screen.getByTestId("bar-chart");
      const chartData = JSON.parse(barChart.getAttribute("data-domains") || "[]");

      // Should be sorted: 33%, 33%, 75%, 80%
      expect(chartData[0].percentage).toBe(33);
      expect(chartData[1].percentage).toBe(33);
      expect(chartData[2].percentage).toBe(75);
      expect(chartData[3].percentage).toBe(80);
    });
  });

  describe("Visual highlighting", () => {
    it("should highlight domains below 50%", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      // Check for visual indicators of weak domains
      const weakDomainIndicators = screen.getAllByTestId("weak-domain-indicator");
      expect(weakDomainIndicators).toHaveLength(2); // Deep Learning and Data Engineering
    });

    it("should use different colors based on performance", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      const cells = screen.getAllByTestId("cell");

      // Should have different colors for different performance levels
      const colors = cells.map((cell) => cell.getAttribute("data-fill"));
      expect(colors).toContain("#ef4444"); // Red for < 50%
      expect(colors).toContain("#22c55e"); // Green for >= 70%
    });
  });

  describe("Interactivity", () => {
    it("should call onDomainClick when domain is clicked", () => {
      const mockOnClick = jest.fn();
      render(<DomainBreakdown domains={mockDomains} onDomainClick={mockOnClick} />);

      const clickableArea = screen.getByTestId("domain-Machine Learning");
      fireEvent.click(clickableArea);

      expect(mockOnClick).toHaveBeenCalledWith("Machine Learning");
    });

    it("should show hover state on domains", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      const domain = screen.getByTestId("domain-MLOps");
      fireEvent.mouseEnter(domain);

      expect(domain).toHaveClass("hover:bg-gray-50");
    });

    it("should show tooltip on hover", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle single domain gracefully", () => {
      const singleDomain: DomainBreakdownType[] = [
        { domain: "Machine Learning", correct: 5, total: 5, percentage: 100 },
      ];

      render(<DomainBreakdown domains={singleDomain} />);

      expect(screen.getByText("5/5")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("should handle empty domains array", () => {
      render(<DomainBreakdown domains={[]} />);

      expect(screen.getByText(/no domain data available/i)).toBeInTheDocument();
    });

    it("should handle domains with 0% score", () => {
      const zeroDomains: DomainBreakdownType[] = [
        { domain: "Machine Learning", correct: 0, total: 5, percentage: 0 },
      ];

      render(<DomainBreakdown domains={zeroDomains} />);

      expect(screen.getByText("0/5")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should handle domains with perfect scores", () => {
      const perfectDomains: DomainBreakdownType[] = [
        { domain: "Machine Learning", correct: 5, total: 5, percentage: 100 },
        { domain: "Deep Learning", correct: 3, total: 3, percentage: 100 },
      ];

      render(<DomainBreakdown domains={perfectDomains} />);

      expect(screen.getByText("5/5")).toBeInTheDocument();
      expect(screen.getByText("3/3")).toBeInTheDocument();
    });
  });

  describe("Responsive design", () => {
    it("should be responsive on mobile", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      const container = screen.getByTestId("domain-breakdown-container");
      expect(container).toHaveClass("w-full");

      const responsiveContainer = screen.getByTestId("responsive-container");
      expect(responsiveContainer).toBeInTheDocument();
    });

    it("should show compact view on small screens", () => {
      // Mock window.innerWidth
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<DomainBreakdown domains={mockDomains} />);

      const content = screen.getByRole("region").querySelector('[data-slot="card-content"]');
      expect(content).toHaveClass("sm:block");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      expect(screen.getByRole("region", { name: /domain breakdown/i })).toBeInTheDocument();
    });

    it("should be keyboard navigable", () => {
      const mockOnClick = jest.fn();
      render(<DomainBreakdown domains={mockDomains} onDomainClick={mockOnClick} />);

      const firstDomain = screen.getByTestId("domain-Machine Learning");
      firstDomain.focus();

      fireEvent.keyDown(firstDomain, { key: "Enter" });
      expect(mockOnClick).toHaveBeenCalledWith("Machine Learning");
    });

    it("should announce domain scores to screen readers", () => {
      render(<DomainBreakdown domains={mockDomains} />);

      const domainScore = screen.getByLabelText(/machine learning: 4 out of 5 correct/i);
      expect(domainScore).toBeInTheDocument();
    });
  });

  describe("Alternative view modes", () => {
    it("should support list view mode", () => {
      render(<DomainBreakdown domains={mockDomains} viewMode="list" />);

      expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
      expect(screen.getByTestId("domain-list")).toBeInTheDocument();
    });

    it("should support compact chart mode", () => {
      render(<DomainBreakdown domains={mockDomains} compact={true} />);

      const content = screen.getByRole("region").querySelector('[data-slot="card-content"]');
      expect(content).toHaveClass("h-48"); // Reduced height
    });
  });

  describe("Performance indicators", () => {
    it("should show improvement suggestions for weak domains", () => {
      render(<DomainBreakdown domains={mockDomains} showSuggestions={true} />);

      // Should show suggestions for domains below 50%
      expect(screen.getByText(/focus on deep learning/i)).toBeInTheDocument();
      expect(screen.getByText(/focus on data engineering/i)).toBeInTheDocument();
    });

    it("should show achievement badges for strong domains", () => {
      render(<DomainBreakdown domains={mockDomains} showBadges={true} />);

      // Should show badges for domains >= 70%
      expect(screen.getByTestId("badge-Machine Learning")).toBeInTheDocument();
      expect(screen.getByTestId("badge-MLOps")).toBeInTheDocument();
    });
  });
});
