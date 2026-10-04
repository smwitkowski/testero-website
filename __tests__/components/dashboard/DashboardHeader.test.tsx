/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/components/providers/AuthProvider";

jest.mock("@/components/providers/AuthProvider");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: {
    full_name: "Alex Hartman",
  },
};

describe("DashboardHeader", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser as any,
      session: null,
      isLoading: false,
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
  });

  it("renders personalized welcome message", () => {
    render(<DashboardHeader />);

    expect(screen.getByText(/Welcome back, Alex Hartman!/i)).toBeInTheDocument();
    expect(screen.getByText(/Let's continue your journey to PMLE certification/i)).toBeInTheDocument();
  });

  it("leaves practice CTAs to the dashboard next-step card", () => {
    render(<DashboardHeader />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("applies custom styling to the welcome header", () => {
    const { container } = render(<DashboardHeader className="custom-header" />);
    expect(container.firstChild).toHaveClass("custom-header");
  });

  it("uses a fallback greeting without a user", () => {
    mockUseAuth.mockReturnValue({
      user: null, session: null, isLoading: false,
      signOut: jest.fn(), refreshSession: jest.fn(),
    });
    render(<DashboardHeader />);
    expect(screen.getByText("Welcome back, there!")).toBeInTheDocument();
  });

  it("uses email when full_name is not available", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "user-123",
        email: "test@example.com",
        user_metadata: {},
      } as any,
      session: null,
      isLoading: false,
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });

    render(<DashboardHeader />);

    expect(screen.getByText(/Welcome back, test!/i)).toBeInTheDocument();
  });
});



