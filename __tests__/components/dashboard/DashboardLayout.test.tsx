/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

describe("DashboardLayout", () => {
  it("renders desktop/mobile sidebar and main content", () => {
    render(
      <DashboardLayout
        sidebar={<div>Sidebar</div>}
        main={<div>Main Content</div>}
      />
    );

    // Sidebar is rendered twice (desktop + mobile), so use getAllByText
    expect(screen.getAllByText("Sidebar").length).toBeGreaterThan(0);
    expect(screen.getByText("Main Content")).toBeInTheDocument();
  });

  it("applies the two-column flex layout", () => {
    const { container } = render(
      <DashboardLayout
        sidebar={<div>Sidebar</div>}
        main={<div>Main Content</div>}
      />
    );

    expect(container.querySelector(".flex")).toHaveClass("h-screen");
    expect(container.querySelector(".flex-1")).toHaveClass("min-w-0", "overflow-y-auto");
  });

  it("accepts custom layout classes", () => {
    const { container } = render(
      <DashboardLayout className="custom-layout"
        sidebar={<div>Sidebar</div>}
        main={<div>Main Content</div>}
      />
    );

    expect(container.firstChild).toHaveClass("custom-layout");

    // Sidebar is rendered twice (desktop + mobile), so use getAllByText
    expect(screen.getAllByText("Sidebar").length).toBeGreaterThan(0);
    expect(screen.getByText("Main Content")).toBeInTheDocument();
  });
});

