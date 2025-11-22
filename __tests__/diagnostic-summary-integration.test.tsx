import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import { useUpsell } from "@/hooks/useUpsell";
import { useTriggerDetection } from "@/hooks/useTriggerDetection";
import DiagnosticSummaryPage from "@/app/diagnostic/[sessionId]/summary/page";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
}));
jest.mock("@/components/providers/AuthProvider");
jest.mock("posthog-js/react");
jest.mock("@/hooks/useUpsell");
jest.mock("@/hooks/useTriggerDetection");

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
  getFeatureFlag: jest.fn(),
  isFeatureEnabled: jest.fn(),
};

const mockUpsell = {
  isOpen: false,
  variant: "default" as const,
  trigger: null,
  maybeOpen: jest.fn(),
  dismiss: jest.fn(),
  handleCTAClick: jest.fn(),
};

const mockTriggers = {
  checkPaywallTrigger: jest.fn(() => false),
  setStudyPlanRef: { current: null },
  trackReviewSectionEntry: jest.fn(),
  trackReviewSectionExit: jest.fn(),
  trackExplanationExpansion: jest.fn(),
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
    (useUpsell as jest.Mock).mockReturnValue(mockUpsell);
    (useTriggerDetection as jest.Mock).mockReturnValue(mockTriggers);
    mockPostHog.capture.mockClear();
    mockPostHog.getFeatureFlag.mockClear();
    mockPostHog.isFeatureEnabled.mockClear();
    mockPostHog.getFeatureFlag.mockReturnValue("control");
    mockPostHog.isFeatureEnabled.mockReturnValue(false);
    mockTriggers.checkPaywallTrigger.mockReturnValue(false);
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

      const heading = await screen.findByRole("heading", { name: /Diagnostic Results/i });
      expect(heading).toBeInTheDocument();

      const scoreRow = screen.getByText(/Score:/i).closest("div");
      expect(scoreRow).not.toBeNull();
      expect(scoreRow).toHaveTextContent(/70\s*%\s*\(\s*10\s*Qs\s*\)/);

      const examRow = screen.getByText(/Exam:/i).closest("div");
      expect(examRow).not.toBeNull();
      expect(examRow).toHaveTextContent(/Google Professional ML Engineer/);

      expect(screen.getAllByText(/70\s*%/).length).toBeGreaterThan(0);
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

      const domainHeading = await screen.findByText(/domain performance/i);
      expect(domainHeading).toBeInTheDocument();
      expect(screen.getAllByText("Machine Learning").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/4\s*\/\s*5/).length).toBeGreaterThan(0);
      expect(screen.getByText(/80\s*%/)).toBeInTheDocument();
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

    it("should request upsell gating feature flags", async () => {
      jest.useFakeTimers({ now: new Date("2024-01-01T00:00:00Z") });
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ...mockSuccessResponse,
          summary: { ...mockSuccessResponse.summary, score: 85 },
        }),
      });

      try {
        render(<DiagnosticSummaryPage />);

        expect(mockPostHog.getFeatureFlag).toHaveBeenCalledWith("upsell_modal_test");

        jest.setSystemTime(new Date("2024-01-01T00:00:25Z"));
        await waitFor(() =>
          expect(mockPostHog.isFeatureEnabled).toHaveBeenCalledWith("upsell_high_score")
        );
      } finally {
        jest.useRealTimers();
      }
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

      const retakeButtons = await screen.findAllByRole("button", { name: /retake diagnostic/i });
      fireEvent.click(retakeButtons[0]);

      expect(mockRouter.push).toHaveBeenCalledWith("/diagnostic");
    });
  });

  describe("Practice Session Creation", () => {
    beforeEach(() => {
      (useAuth as jest.Mock).mockReturnValue({ 
        user: { id: "user-123", user_metadata: { has_subscription: true } }, 
        isLoading: false 
      });
    });

    it("should create practice session from top CTA with weakest domains", async () => {
      const mockPracticeResponse = {
        sessionId: "practice-session-456",
        route: "/practice?sessionId=practice-session-456",
        questionCount: 10,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSuccessResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockPracticeResponse,
        });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole("button", { 
        name: /start 10-min practice on your weakest topics/i 
      });
      fireEvent.click(practiceButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/practice/session",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              examKey: "pmle",
              domainCodes: expect.arrayContaining([expect.any(String)]),
              questionCount: 10,
              source: "diagnostic_summary",
              sourceSessionId: "test-session-123",
            }),
          })
        );
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/practice?sessionId=practice-session-456");
      });

      expect(mockPostHog.capture).toHaveBeenCalledWith(
        "practice_session_created_from_diagnostic",
        expect.objectContaining({
          diagnosticSessionId: "test-session-123",
          domainCodes: expect.any(Array),
          questionCount: 10,
        })
      );
    });

    it("should create practice session from Study Plan CTA with single domain", async () => {
      const mockPracticeResponse = {
        sessionId: "practice-session-789",
        route: "/practice?sessionId=practice-session-789",
        questionCount: 10,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSuccessResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockPracticeResponse,
        });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/study plan/i)).toBeInTheDocument();
      });

      const studyPlanButtons = screen.getAllByRole("button", { 
        name: /start practice \(10\)/i 
      });
      
      if (studyPlanButtons.length > 0) {
        fireEvent.click(studyPlanButtons[0]);

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            "/api/practice/session",
            expect.objectContaining({
              method: "POST",
              body: expect.stringContaining('"questionCount":10'),
            })
          );
        });

        await waitFor(() => {
          expect(mockRouter.push).toHaveBeenCalledWith("/practice?sessionId=practice-session-789");
        });
      }
    });

    it("should show error toast when practice session creation fails", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSuccessResponse,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: "Failed to create practice session" }),
        });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole("button", { 
        name: /start 10-min practice on your weakest topics/i 
      });
      fireEvent.click(practiceButton);

      await waitFor(() => {
        expect(screen.getByText(/couldn't start practice/i)).toBeInTheDocument();
      });

      // Should not navigate on error
      expect(mockRouter.push).not.toHaveBeenCalledWith(
        expect.stringContaining("/practice")
      );

      // Should track error
      expect(mockPostHog.capture).toHaveBeenCalledWith(
        "practice_session_creation_failed_from_diagnostic",
        expect.objectContaining({
          diagnosticSessionId: "test-session-123",
          statusCode: 500,
        })
      );
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSuccessResponse,
        })
        .mockRejectedValueOnce(new Error("Network error"));

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole("button", { 
        name: /start 10-min practice on your weakest topics/i 
      });
      fireEvent.click(practiceButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("should not call API when paywall trigger blocks practice", async () => {
      mockTriggers.checkPaywallTrigger.mockReturnValue(true);

      (useAuth as jest.Mock).mockReturnValue({ 
        user: { id: "user-123", user_metadata: { has_subscription: false } }, 
        isLoading: false 
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole("button", { 
        name: /start 10-min practice on your weakest topics/i 
      });
      fireEvent.click(practiceButton);

      // Wait a bit to ensure no API call is made
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not call practice session API
      const practiceApiCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (call) => call[0]?.includes("/api/practice/session")
      );
      expect(practiceApiCalls.length).toBe(0);

      // Reset mock for other tests
      mockTriggers.checkPaywallTrigger.mockReturnValue(false);
    });

    it("should compute weakest domains correctly from domain breakdown", async () => {
      const mockResponseWithWeakDomains = {
        ...mockSuccessResponse,
        domainBreakdown: [
          { domain: "Architecting Low-Code ML Solutions", correct: 1, total: 5, percentage: 20 },
          { domain: "Collaborating to Manage Data & Models", correct: 2, total: 5, percentage: 40 },
          { domain: "Scaling Prototypes into ML Models", correct: 4, total: 5, percentage: 80 },
        ],
      };

      const mockPracticeResponse = {
        sessionId: "practice-session-999",
        route: "/practice?sessionId=practice-session-999",
        questionCount: 10,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockResponseWithWeakDomains,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockPracticeResponse,
        });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole("button", { 
        name: /start 10-min practice on your weakest topics/i 
      });
      fireEvent.click(practiceButton);

      await waitFor(() => {
        const practiceCall = (global.fetch as jest.Mock).mock.calls.find(
          (call) => call[0]?.includes("/api/practice/session")
        );
        expect(practiceCall).toBeDefined();
        const body = JSON.parse(practiceCall[1].body);
        // Should select weakest domains (lowest percentages)
        expect(body.domainCodes.length).toBeGreaterThan(0);
        expect(body.domainCodes.length).toBeLessThanOrEqual(3);
      });
    });
  });

  describe("Question details display", () => {
    it("should display all questions with correct indicators", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/what is machine learning/i)).toBeInTheDocument();
        expect(screen.getByText(/what is deep learning/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Correct/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Incorrect/).length).toBeGreaterThan(0);
      });
    });

    it("should highlight user answers and correct answers", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      const expandButtons = await screen.findAllByRole("button", { name: /view explanation/i });
      expandButtons.forEach((button) => fireEvent.click(button));

      await waitFor(() => {
        expect(screen.getAllByText(/your answer/i).length).toBeGreaterThan(0);
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
