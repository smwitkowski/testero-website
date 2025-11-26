/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

describe("DashboardLayout", () => {
  it("renders sidebar, main content, and right panel", () => {
    render(
      <DashboardLayout
        sidebar={<div>Sidebar</div>}
        main={<div>Main Content</div>}
        rightPanel={<div>Right Panel</div>}
      />
    );

    // Sidebar is rendered twice (desktop + mobile), so use getAllByText
    expect(screen.getAllByText("Sidebar").length).toBeGreaterThan(0);
    expect(screen.getByText("Main Content")).toBeInTheDocument();
    expect(screen.getByText("Right Panel")).toBeInTheDocument();
  });

  it("applies responsive grid layout classes", () => {
    const { container } = render(
      <DashboardLayout
        sidebar={<div>Sidebar</div>}
        main={<div>Main Content</div>}
        rightPanel={<div>Right Panel</div>}
      />
    );

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-1", "lg:grid-cols-12");
  });

  it("renders without right panel", () => {
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
});

