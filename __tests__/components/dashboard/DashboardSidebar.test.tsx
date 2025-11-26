/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { useAuth } from "@/components/providers/AuthProvider";

// Mock the AuthProvider
jest.mock("@/components/providers/AuthProvider");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: {
    full_name: "Alex Hartman",
  },
};

describe("DashboardSidebar", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser as any,
      session: null,
      isLoading: false,
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
  });

  it("renders user profile with name and exam", () => {
    render(<DashboardSidebar activeItem="dashboard" />);

    expect(screen.getByText("Alex Hartman")).toBeInTheDocument();
    expect(screen.getByText(/Studying for PMLE/i)).toBeInTheDocument();
  });

  it("highlights active navigation item", () => {
    render(<DashboardSidebar activeItem="dashboard" />);

    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("renders upgrade button for non-subscribers", () => {
    render(<DashboardSidebar activeItem="dashboard" showUpgradeCTA={true} />);

    expect(screen.getByRole("button", { name: /Upgrade Plan/i })).toBeInTheDocument();
  });

  it("hides upgrade button for subscribers", () => {
    render(<DashboardSidebar activeItem="dashboard" showUpgradeCTA={false} />);

    expect(screen.queryByRole("button", { name: /Upgrade Plan/i })).not.toBeInTheDocument();
  });

  it("calls onNavigate when nav item clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();

    render(<DashboardSidebar activeItem="dashboard" onNavigate={onNavigate} />);

    const practiceLink = screen.getByRole("link", { name: /Practice Exams/i });
    await user.click(practiceLink);

    expect(onNavigate).toHaveBeenCalledWith("practice");
  });

  it("renders all navigation items", () => {
    render(<DashboardSidebar activeItem="dashboard" />);

    expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Practice Exams/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Performance/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Study Plan/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Settings/i })).toBeInTheDocument();
  });

  it("calls onUpgrade when upgrade button clicked", async () => {
    const user = userEvent.setup();
    const onUpgrade = jest.fn();

    render(
      <DashboardSidebar activeItem="dashboard" showUpgradeCTA={true} onUpgrade={onUpgrade} />
    );

    const upgradeButton = screen.getByRole("button", { name: /Upgrade Plan/i });
    await user.click(upgradeButton);

    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });
});

