import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import DiagnosticSummaryPage from "@/app/diagnostic/[sessionId]/summary/page";

// Mock dependencies
jest.mock("next/navigation");
jest.mock("@/components/providers/AuthProvider");
jest.mock("posthog-js/react");

// Mock fetch globally
global.fetch = jest.fn();

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
};

const mockPostHog = {
  capture: jest.fn(),
};

const mockSuccessResponse = {
  summary: {
    sessionId: "test-session-123",
    examType: "Google Professional ML Engineer",
    totalQuestions: 10,
    correctAnswers: 7,
    score: 70,
    startedAt: "2024-01-01T10:00:00Z",
    completedAt: "2024-01-01T10:30:00Z",
    questions: [
      {
        id: "q1",
        stem: "What is machine learning?",
        userAnswer: "A",
        correctAnswer: "A",
        isCorrect: true,
        options: [
          { label: "A", text: "A method of data analysis" },
          { label: "B", text: "A type of database" },
        ],
      },
      {
        id: "q2",
        stem: "What is deep learning?",
        userAnswer: "B",
        correctAnswer: "A",
        isCorrect: false,
        options: [
          { label: "A", text: "A subset of machine learning" },
          { label: "B", text: "A programming language" },
        ],
      },
    ],
  },
  domainBreakdown: [
    { domain: "Machine Learning", correct: 4, total: 5, percentage: 80 },
    { domain: "Deep Learning", correct: 3, total: 5, percentage: 60 },
  ],
};

describe("DiagnosticSummaryPage Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ sessionId: "test-session-123" });
    (usePostHog as jest.Mock).mockReturnValue(mockPostHog);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSuccessResponse,
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  });

  describe("Loading state", () => {
    it("should display loading state initially", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });

      render(<DiagnosticSummaryPage />);

      expect(screen.getByText(/loading diagnostic summary/i)).toBeInTheDocument();
    });

    it("should wait for auth state before fetching", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });

      render(<DiagnosticSummaryPage />);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Fetching and displaying data", () => {
    it("should fetch and display complete session data", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" }, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/diagnostic/summary/test-session-123");
      });

      await waitFor(() => {
        expect(screen.getByText("Diagnostic Results")).toBeInTheDocument();
        expect(screen.getByText("70%")).toBeInTheDocument();
        expect(screen.getByText("7/10")).toBeInTheDocument();
        expect(screen.getByText("Google Professional ML Engineer")).toBeInTheDocument();
      });
    });

    it("should include anonymous session ID for non-authenticated users", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (window.localStorage.getItem as jest.Mock).mockReturnValue("anon-session-456");

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/diagnostic/summary/test-session-123?anonymousSessionId=anon-session-456"
        );
      });
    });

    it("should display domain breakdown when available", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/score by domain/i)).toBeInTheDocument();
        expect(screen.getByText("Machine Learning")).toBeInTheDocument();
        expect(screen.getByText("4/5")).toBeInTheDocument();
        expect(screen.getByText("80%")).toBeInTheDocument();
      });
    });
  });

  describe("Error states", () => {
    it("should handle 404 error (session not found)", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "Session not found" }),
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/summary not found/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /start new diagnostic/i })).toBeInTheDocument();
      });
    });

    it("should handle 403 error (access denied)", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: "Access denied" }),
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
    });

    it("should handle 400 error (session not completed)", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Session not completed" }),
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic not completed/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /continue diagnostic/i })).toBeInTheDocument();
      });
    });

    it("should handle generic errors", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load diagnostic summary/i)).toBeInTheDocument();
      });
    });
  });

  describe("Analytics tracking", () => {
    it("should track summary view with correct data", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(mockPostHog.capture).toHaveBeenCalledWith("diagnostic_summary_viewed", {
          sessionId: "test-session-123",
          examType: "Google Professional ML Engineer",
          score: 70,
          totalQuestions: 10,
          correctAnswers: 7,
          domainCount: 2,
        });
      });
    });

    it("should not track when loading fails", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });

      expect(mockPostHog.capture).not.toHaveBeenCalled();
    });
  });

  describe("LocalStorage cleanup", () => {
    it("should clean up localStorage after viewing summary", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(window.localStorage.removeItem).toHaveBeenCalledWith(
          "testero_diagnostic_session_id"
        );
      });
    });

    it("should not clean up localStorage on error", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });

      expect(window.localStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe("Navigation", () => {
    it("should navigate to new diagnostic on button click", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /take another diagnostic/i });
        button.click();
      });

      expect(mockRouter.push).toHaveBeenCalledWith("/diagnostic");
    });

    it("should show study plan alert on button click", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      const alertSpy = jest.spyOn(window, "alert").mockImplementation();

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /start my study plan/i });
        button.click();
      });

      expect(alertSpy).toHaveBeenCalledWith("Study plan feature coming soon!");
      alertSpy.mockRestore();
    });
  });

  describe("Question details display", () => {
    it("should display all questions with correct indicators", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText("Question 1")).toBeInTheDocument();
        expect(screen.getByText("Question 2")).toBeInTheDocument();
        expect(screen.getByText("CORRECT")).toBeInTheDocument();
        expect(screen.getByText("INCORRECT")).toBeInTheDocument();
      });
    });

    it("should highlight user answers and correct answers", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getAllByText(/your answer/i)).toHaveLength(2);
        const correctIndicators = screen.getAllByText(/✓ correct/i);
        expect(correctIndicators.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle missing session ID", async () => {
      (useParams as jest.Mock).mockReturnValue({ sessionId: null });
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/session id not found/i)).toBeInTheDocument();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle empty question list", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          summary: { ...mockSuccessResponse.summary, questions: [] },
          domainBreakdown: [],
        }),
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText("Diagnostic Results")).toBeInTheDocument();
        expect(screen.queryByText("Question 1")).not.toBeInTheDocument();
      });
    });
  });
});
