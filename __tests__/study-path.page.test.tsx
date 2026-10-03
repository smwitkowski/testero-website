import React from "react";
import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import StudyPathPage from "@/app/study-path/page";

// Mock the modules
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

jest.mock("@/components/providers/AuthProvider", () => ({
  useAuth: jest.fn(),
}));

describe("StudyPathPage - Authentication", () => {
  const mockPush = jest.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe("Authentication Requirements", () => {
    it("should allow access for authenticated users", () => {
      // Mock authenticated user
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: "test-user", email: "test@example.com" },
        isLoading: false,
      });

      render(<StudyPathPage />);

      // Should display study path content
      expect(screen.getByRole("heading", { name: /study path/i })).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should show signup and login options for anonymous users", () => {
      // Mock anonymous user
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
      });

      render(<StudyPathPage />);

      // The public study path preview offers signup and login (f32df17).
      expect(screen.getByRole("heading", { name: /sign up to see full path/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign up to see full path/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });

    it("should redirect to login when sign in button is clicked", () => {
      // Mock anonymous user
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
      });

      render(<StudyPathPage />);

      const signInButton = screen.getByRole("button", { name: /sign in/i });
      signInButton.click();

      expect(mockPush).toHaveBeenCalledWith("/login?redirect=%2Fstudy-path");
    });

    it("should render the public preview while authentication resolves", () => {
      // Mock loading state
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: true,
      });

      render(<StudyPathPage />);

      // Client auth loading gates were removed in 1fdddf4; middleware owns protection.
      expect(screen.getByRole("heading", { name: /sign up to see full path/i })).toBeInTheDocument();
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    it("should preserve diagnostic data after login redirect", () => {
      // Mock anonymous user with diagnostic data in sessionStorage
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isLoading: false,
      });

      // Set up diagnostic data
      const diagnosticData = {
        score: 60,
        domains: [{ domain: "ML Basics", correct: 3, total: 5, percentage: 60 }],
      };

      Object.defineProperty(window, "sessionStorage", {
        value: {
          getItem: jest.fn(() => JSON.stringify(diagnosticData)),
          setItem: jest.fn(),
        },
        writable: true,
      });

      render(<StudyPathPage />);

      // Should still show the data even when prompting for login
      expect(screen.getByText("60%")).toBeInTheDocument();
    });
  });
});
