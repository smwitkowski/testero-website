/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserDropdown } from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/components/providers/AuthProvider";

// Mock the AuthProvider
jest.mock("@/components/providers/AuthProvider");

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const mockUser = {
  id: "user-123",
  email: "stephen@example.com",
  user_metadata: {
    full_name: "Stephen Witkowski",
  },
};

describe("UserDropdown", () => {
  const mockSignOut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser as any,
      session: null,
      isLoading: false,
      signOut: mockSignOut,
      refreshSession: jest.fn(),
    });
  });

  it("renders user avatar with correct initials", () => {
    render(<UserDropdown />);

    // Avatar should show initials (first letter of first and last name)
    expect(screen.getByText("SW")).toBeInTheDocument();
  });

  it("renders user avatar with email initial when no name", () => {
    mockUseAuth.mockReturnValue({
      user: {
        ...mockUser,
        user_metadata: {},
      } as any,
      session: null,
      isLoading: false,
      signOut: mockSignOut,
      refreshSession: jest.fn(),
    });

    render(<UserDropdown />);

    // Should show first letter of email (capitalized)
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("opens dropdown on click", async () => {
    const user = userEvent.setup();
    render(<UserDropdown />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    // Wait for dropdown to appear
    await waitFor(() => {
      expect(screen.getByText("stephen@example.com")).toBeInTheDocument();
    });
  });

  it("displays correct menu items", async () => {
    const user = userEvent.setup();
    render(<UserDropdown />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Settings/i)).toBeInTheDocument();
      expect(screen.getByText(/Help & FAQ/i)).toBeInTheDocument();
      expect(screen.getByText(/Send Feedback/i)).toBeInTheDocument();
      expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
    });
  });

  it("calls signOut when Sign Out clicked", async () => {
    const user = userEvent.setup();
    render(<UserDropdown />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
    });

    const signOutButton = screen.getByText(/Sign Out/i);
    await user.click(signOutButton);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("closes dropdown on item selection", async () => {
    const user = userEvent.setup();
    render(<UserDropdown />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/Settings/i)).toBeInTheDocument();
    });

    const settingsItem = screen.getByText(/Settings/i);
    await user.click(settingsItem);

    // Dropdown should close (menu items not in document)
    await waitFor(() => {
      expect(screen.queryByText(/Settings/i)).not.toBeInTheDocument();
    });
  });

  it("displays user email in dropdown", async () => {
    const user = userEvent.setup();
    render(<UserDropdown />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("stephen@example.com")).toBeInTheDocument();
    });
  });

  it("displays user name in dropdown when available", async () => {
    const user = userEvent.setup();
    render(<UserDropdown />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("stephen.witkowski")).toBeInTheDocument();
    });
  });
});

