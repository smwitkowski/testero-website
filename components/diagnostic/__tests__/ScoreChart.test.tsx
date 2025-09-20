import { render, screen } from "@testing-library/react";
import React from "react";

import { ScoreChart } from "../ScoreChart";

describe("ScoreChart", () => {
  it("uses semantic tone classes without inline color styles", () => {
    const { rerender } = render(<ScoreChart score={30} showStatus />);

    const getScoreValue = () => screen.getByText(/\d+%/);
    const getStatusText = () =>
      screen.getByText(/Excellent Performance|Good Progress|Keep Practicing|Needs Improvement/);
    const getProgressCircle = () => screen.getByTestId("progress-circle");

    expect(getScoreValue()).toHaveClass("text-error");
    expect(getScoreValue()).not.toHaveAttribute("style");
    expect(getStatusText()).toHaveClass("text-error");
    expect(getStatusText()).not.toHaveAttribute("style");
    expect(getProgressCircle()).toHaveAttribute("stroke", "currentColor");
    expect(getProgressCircle()).toHaveClass("text-error");

    rerender(<ScoreChart score={55} showStatus />);
    expect(getScoreValue()).toHaveClass("text-warning");
    expect(getStatusText()).toHaveTextContent("Keep Practicing");
    expect(getProgressCircle()).toHaveClass("text-warning");

    rerender(<ScoreChart score={85} showStatus />);
    expect(getScoreValue()).toHaveClass("text-success");
    expect(getStatusText()).toHaveTextContent("Good Progress");
    expect(getProgressCircle()).toHaveClass("text-success");
  });
});
