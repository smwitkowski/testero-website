/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders both CTA buttons", () => {
    render(<DashboardHeader />);

    expect(screen.getByRole("button", { name: /Start New Practice Exam/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Weakest Areas/i })).toBeInTheDocument();
  });

  it("calls onStartPractice when primary CTA clicked", async () => {
    const user = userEvent.setup();
    const onStartPractice = jest.fn();

    render(<DashboardHeader onStartPractice={onStartPractice} />);

    const button = screen.getByRole("button", { name: /Start New Practice Exam/i });
    await user.click(button);

    expect(onStartPractice).toHaveBeenCalledTimes(1);
  });

  it("calls onReviewWeakest when secondary CTA clicked", async () => {
    const user = userEvent.setup();
    const onReviewWeakest = jest.fn();

    render(<DashboardHeader onReviewWeakest={onReviewWeakest} />);

    const button = screen.getByRole("button", { name: /Review Weakest Areas/i });
    await user.click(button);

    expect(onReviewWeakest).toHaveBeenCalledTimes(1);
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


