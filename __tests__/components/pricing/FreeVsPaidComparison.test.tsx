import React from "react";
import { render, screen } from "@testing-library/react";
import { FreeVsPaidComparison } from "@/components/pricing/FreeVsPaidComparison";

describe("FreeVsPaidComparison", () => {
  it("describes PMLE Pass without a subscription or single-diagnostic restriction", () => {
    const { container } = render(<FreeVsPaidComparison />);
    expect(screen.getAllByText("PMLE Pass")).toHaveLength(2);
    expect(screen.getAllByText("US$39 once · 90 days · No renewal")).toHaveLength(2);
    expect(container.textContent).not.toMatch(/one PMLE diagnostic|retakes|paid subscription|full access with subscription/i);
  });
  it("keeps the real free diagnostic and metered practice offer", () => {
    render(<FreeVsPaidComparison />);
    expect(screen.getAllByText("PMLE diagnostic")).toHaveLength(4);
    expect(screen.getAllByText("Limited practice (5 questions/week)")).toHaveLength(4);
  });
});
