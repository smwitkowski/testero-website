import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ScoreChart } from "@/components/diagnostic/ScoreChart";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    svg: ({ children, ...props }: any) => <svg {...props}>{children}</svg>,
    circle: ({ children, ...props }: any) => <circle {...props}>{children}</circle>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe("ScoreChart", () => {
  describe("Basic rendering", () => {
    it("should render circular progress with correct percentage", () => {
      render(<ScoreChart score={75} />);

      expect(screen.getByText("75%")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: /score chart showing 75%/i })).toBeInTheDocument();
    });

    it("should render with different sizes", () => {
      const { rerender } = render(<ScoreChart score={50} size="sm" />);
      expect(screen.getByTestId("score-chart")).toHaveClass("w-20 h-20");

      rerender(<ScoreChart score={50} size="md" />);
      expect(screen.getByTestId("score-chart")).toHaveClass("w-32 h-32");

      rerender(<ScoreChart score={50} size="lg" />);
      expect(screen.getByTestId("score-chart")).toHaveClass("w-48 h-48");
    });
  });

  describe("Color coding", () => {
    it("should use green color for scores >= 70%", () => {
      render(<ScoreChart score={85} />);

      const progressCircle = screen.getByTestId("progress-circle");
      expect(progressCircle).toHaveAttribute("stroke", expect.stringMatching(/22c55e|green/i));
    });

    it("should use orange color for scores 50-69%", () => {
      render(<ScoreChart score={60} />);

      const progressCircle = screen.getByTestId("progress-circle");
      expect(progressCircle).toHaveAttribute(
        "stroke",
        expect.stringMatching(/f59e0b|orange|amber/i)
      );
    });

    it("should use red color for scores < 50%", () => {
      render(<ScoreChart score={30} />);

      const progressCircle = screen.getByTestId("progress-circle");
      expect(progressCircle).toHaveAttribute("stroke", expect.stringMatching(/ef4444|red/i));
    });
  });

  describe("Animation", () => {
    it("should animate on mount when animated prop is true", async () => {
      render(<ScoreChart score={75} animated={true} />);

      const progressCircle = screen.getByTestId("progress-circle");

      // Initially should have strokeDashoffset for 0%
      expect(progressCircle).toHaveAttribute("stroke-dashoffset");

      // Should animate to the correct value
      await waitFor(() => {
        expect(progressCircle).toHaveAttribute("stroke-dasharray");
      });
    });

    it("should not animate when animated prop is false", () => {
      render(<ScoreChart score={75} animated={false} />);

      const progressCircle = screen.getByTestId("progress-circle");
      expect(progressCircle).toHaveAttribute("stroke-dashoffset");
      expect(progressCircle).not.toHaveClass("transition-all");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", () => {
      render(<ScoreChart score={67} />);

      const chart = screen.getByRole("img", { name: /score chart showing 67%/i });
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/score chart showing 67%/i)
      );
    });

    it("should have descriptive text for screen readers", () => {
      render(<ScoreChart score={80} />);

      expect(screen.getByText("80%")).toHaveAttribute("aria-live", "polite");
      expect(screen.getByText("80%")).toHaveAttribute("aria-atomic", "true");
    });

    it("should include performance level in aria-label", () => {
      const { rerender } = render(<ScoreChart score={90} />);
      expect(screen.getByRole("img")).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/excellent|ready/i)
      );

      rerender(<ScoreChart score={65} />);
      expect(screen.getByRole("img")).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/good|progress/i)
      );

      rerender(<ScoreChart score={40} />);
      expect(screen.getByRole("img")).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/needs work|improvement/i)
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle 0% score", () => {
      render(<ScoreChart score={0} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
      const progressCircle = screen.getByTestId("progress-circle");
      expect(progressCircle).toHaveAttribute("stroke", expect.stringMatching(/ef4444|red/i));
    });

    it("should handle 100% score", () => {
      render(<ScoreChart score={100} />);

      expect(screen.getByText("100%")).toBeInTheDocument();
      const progressCircle = screen.getByTestId("progress-circle");
      expect(progressCircle).toHaveAttribute("stroke", expect.stringMatching(/22c55e|green/i));
    });

    it("should handle decimal scores by rounding", () => {
      render(<ScoreChart score={75.6} />);

      expect(screen.getByText("76%")).toBeInTheDocument();
    });

    it("should clamp scores above 100 to 100", () => {
      render(<ScoreChart score={150} />);

      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("should clamp negative scores to 0", () => {
      render(<ScoreChart score={-10} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
    });
  });

  describe("Visual elements", () => {
    it("should render background circle", () => {
      render(<ScoreChart score={50} />);

      const circles = screen.getAllByTestId(/circle/i);
      expect(circles.length).toBeGreaterThanOrEqual(2); // Background and progress circles
    });

    it("should render with correct stroke width", () => {
      render(<ScoreChart score={50} />);

      const progressCircle = screen.getByTestId("progress-circle");
      expect(progressCircle).toHaveAttribute("stroke-width", expect.stringMatching(/[4-8]/));
    });

    it("should center the percentage text", () => {
      render(<ScoreChart score={75} />);

      const percentageText = screen.getByText("75%");
      const container = percentageText.closest("div");
      expect(container).toHaveClass("absolute inset-0 flex items-center justify-center");
    });
  });

  describe("Custom className support", () => {
    it("should apply custom className", () => {
      render(<ScoreChart score={50} className="custom-class" />);

      expect(screen.getByTestId("score-chart")).toHaveClass("custom-class");
    });
  });

  describe("Score status text", () => {
    it("should show status text when showStatus prop is true", () => {
      render(<ScoreChart score={85} showStatus={true} />);

      expect(screen.getByText(/good progress/i)).toBeInTheDocument();
    });

    it("should not show status text when showStatus prop is false", () => {
      render(<ScoreChart score={85} showStatus={false} />);

      expect(screen.queryByText(/excellent|ready/i)).not.toBeInTheDocument();
    });
  });
});
