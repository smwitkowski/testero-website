/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "@/components/dashboard/TopBar";

// Mock the UserDropdown component
jest.mock("@/components/dashboard/UserDropdown", () => ({
  UserDropdown: () => <div data-testid="user-dropdown">UserDropdown</div>,
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("TopBar", () => {
  const mockOnMenuToggle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders logo linking to /dashboard", () => {
    render(<TopBar onMenuToggle={mockOnMenuToggle} />);

    const logoLink = screen.getByRole("link", { name: /Testero/i });
    expect(logoLink).toHaveAttribute("href", "/dashboard");
  });

  it("renders notification bell placeholder", () => {
    render(<TopBar onMenuToggle={mockOnMenuToggle} />);

    // Notification bell should be present (aria-label for accessibility)
    const bellButton = screen.getByRole("button", { name: /notifications/i });
    expect(bellButton).toBeInTheDocument();
  });

  it("renders UserDropdown component", () => {
    render(<TopBar onMenuToggle={mockOnMenuToggle} />);

    expect(screen.getByTestId("user-dropdown")).toBeInTheDocument();
  });

  it("shows hamburger menu on mobile viewport", () => {
    // Mock window.matchMedia for mobile
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: query === "(max-width: 1023px)", // lg breakpoint
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<TopBar onMenuToggle={mockOnMenuToggle} />);

    const hamburgerButton = screen.getByRole("button", { name: /toggle menu/i });
    expect(hamburgerButton).toBeInTheDocument();
  });

  it("calls onMenuToggle when hamburger clicked", async () => {
    const user = userEvent.setup();

    // Mock window.matchMedia for mobile
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: query === "(max-width: 1023px)",
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<TopBar onMenuToggle={mockOnMenuToggle} />);

    const hamburgerButton = screen.getByRole("button", { name: /toggle menu/i });
    await user.click(hamburgerButton);

    expect(mockOnMenuToggle).toHaveBeenCalledTimes(1);
  });

  it("has correct height styling", () => {
    const { container } = render(<TopBar onMenuToggle={mockOnMenuToggle} />);

    const topBar = container.querySelector("header");
    expect(topBar).toHaveClass("h-[56px]");
  });
});

