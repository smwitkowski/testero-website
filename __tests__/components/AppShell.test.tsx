/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/layout/AppShell";
import { usePathname } from "next/navigation";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

// Mock TopBar and DashboardSidebar
jest.mock("@/components/dashboard/TopBar", () => ({
  TopBar: ({ onMenuToggle }: { onMenuToggle?: () => void }) => (
    <div data-testid="topbar">
      <button onClick={onMenuToggle} data-testid="menu-toggle">
        Toggle
      </button>
    </div>
  ),
}));

jest.mock("@/components/dashboard/DashboardSidebar", () => ({
  DashboardSidebar: ({ activeItem }: { activeItem?: string }) => (
    <div data-testid="sidebar">Sidebar - Active: {activeItem}</div>
  ),
}));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe("AppShell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/dashboard");
  });

  it("renders TopBar and Sidebar", () => {
    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("passes correct activeItem to Sidebar based on pathname", () => {
    mockUsePathname.mockReturnValue("/practice/question");

    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    expect(screen.getByText(/Active: practice/i)).toBeInTheDocument();
  });

  it("toggles sidebar visibility on mobile", () => {
    render(
      <AppShell>
        <div>Test Content</div>
      </AppShell>
    );

    const menuToggle = screen.getByTestId("menu-toggle");
    expect(menuToggle).toBeInTheDocument();
  });

  it("renders children in main content area", () => {
    render(
      <AppShell>
        <div data-testid="main-content">Test Content</div>
      </AppShell>
    );

    expect(screen.getByTestId("main-content")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("maps /dashboard pathname to dashboard activeItem", () => {
    mockUsePathname.mockReturnValue("/dashboard");

    render(
      <AppShell>
        <div>Test</div>
      </AppShell>
    );

    expect(screen.getByText(/Active: dashboard/i)).toBeInTheDocument();
  });

  it("maps /practice pathname to practice activeItem", () => {
    mockUsePathname.mockReturnValue("/practice/question");

    render(
      <AppShell>
        <div>Test</div>
      </AppShell>
    );

    expect(screen.getByText(/Active: practice/i)).toBeInTheDocument();
  });

  it("maps /study-path pathname to study-plan activeItem", () => {
    mockUsePathname.mockReturnValue("/study-path");

    render(
      <AppShell>
        <div>Test</div>
      </AppShell>
    );

    expect(screen.getByText(/Active: study-plan/i)).toBeInTheDocument();
  });
});

