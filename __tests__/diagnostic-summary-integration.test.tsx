import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";
import { useUpsell } from "@/hooks/useUpsell";
import { useTriggerDetection } from "@/hooks/useTriggerDetection";
import DiagnosticSummaryPage from "@/app/diagnostic/[sessionId]/summary/page";
import { ANALYTICS_EVENTS } from "@/lib/analytics/analytics";

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
  onFeatureFlags: jest.fn((callback) => {
    // Immediately call callback to simulate flags being loaded
    callback();
  }),
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
        domain: "Architecting Low-Code ML Solutions",
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
        domain: "Collaborating to Manage Data & Models",
        options: [
          { label: "A", text: "A subset of machine learning" },
          { label: "B", text: "A programming language" },
        ],
      },
    ],
  },
  domainBreakdown: [
    { domain: "Architecting Low-Code ML Solutions", correct: 4, total: 5, percentage: 80 },
    { domain: "Collaborating to Manage Data & Models", correct: 3, total: 5, percentage: 60 },
  ],
};

// Route responses by endpoint: billing/access changes can trigger a second summary fetch.
const mockSummaryAndPractice = (summaryData: unknown, practiceResponse: unknown) => {
  (global.fetch as jest.Mock).mockReset().mockImplementation((url: string) => {
    if (url.includes("/api/billing/status")) {
      return Promise.resolve({ ok: true, json: async () => ({ isSubscriber: false }) });
    }
    if (url.includes("/api/diagnostic/summary")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => summaryData });
    }
    if (url.includes("/api/practice/session")) {
      return practiceResponse instanceof Error
        ? Promise.reject(practiceResponse) : Promise.resolve(practiceResponse);
    }
    return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
  });
};

describe("DiagnosticSummaryPage Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
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
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ isSubscriber: false }) })
      .mockResolvedValue({
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

  describe("identity and session isolation", () => {
    const secretResponse = {
      ...mockSuccessResponse,
      summary: { ...mockSuccessResponse.summary, questions: [{
        ...mockSuccessResponse.summary.questions[0], stem: "Account A secret question", explanation: "Account A paid explanation",
      }] },
    };
    const deferred = () => {
      let resolve!: (value: unknown) => void;
      const promise = new Promise((done) => { resolve = done; });
      return { promise, resolve };
    };
    it("hides loaded paid questions synchronously when the new account requests fail", async () => {
      const accountA = { id: "paid-a" };
      (useAuth as jest.Mock).mockReturnValue({ user: accountA, isLoading: false });
      (global.fetch as jest.Mock).mockReset().mockImplementation((url: string) => Promise.resolve({
        ok: true, status: 200, json: async () => url.includes("/api/billing/status") ? { isSubscriber: true } : secretResponse,
      }));
      const view = render(<DiagnosticSummaryPage />);
      const expand = await screen.findByRole("button", { name: /^view explanation$/i });
      fireEvent.click(expand);
      expect(screen.getByText("Account A paid explanation")).toBeInTheDocument();
      (useAuth as jest.Mock).mockReturnValue({ user: { id: "free-b" }, isLoading: false });
      (global.fetch as jest.Mock).mockRejectedValue(new Error("account B offline"));
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      view.rerender(<DiagnosticSummaryPage />);
      expect(screen.queryByText("Account A secret question")).not.toBeInTheDocument();
      expect(screen.queryByText("Account A paid explanation")).not.toBeInTheDocument();
      await screen.findByText("Failed to load diagnostic summary");
      expect(screen.queryByRole("button", { name: /view explanation/i })).not.toBeInTheDocument();
      spy.mockRestore();
    });
    it("ignores late paid billing and summary responses after account and session change", async () => {
      const billingA = deferred();
      const summaryA = deferred();
      (useAuth as jest.Mock).mockReturnValue({ user: { id: "paid-a" }, isLoading: false });
      (global.fetch as jest.Mock).mockReset().mockImplementation((url: string) =>
        url.includes("/api/billing/status") ? billingA.promise : summaryA.promise);
      const view = render(<DiagnosticSummaryPage />);
      (useAuth as jest.Mock).mockReturnValue({ user: { id: "free-b" }, isLoading: false });
      (useParams as jest.Mock).mockReturnValue({ sessionId: "session-b" });
      const accountBResponse = { ...mockSuccessResponse, summary: {
        ...mockSuccessResponse.summary, sessionId: "session-b", questions: [{
          ...mockSuccessResponse.summary.questions[0], stem: "Account B question", explanation: null,
        }],
      } };
      (global.fetch as jest.Mock).mockReset().mockImplementation((url: string) => Promise.resolve({
        ok: true, status: 200, json: async () => url.includes("/api/billing/status") ? { isSubscriber: false } : accountBResponse,
      }));
      view.rerender(<DiagnosticSummaryPage />);
      await screen.findByText("Account B question");
      await act(async () => {
        billingA.resolve({ ok: true, status: 200, json: async () => ({ isSubscriber: true }) });
        summaryA.resolve({ ok: true, status: 200, json: async () => secretResponse });
      });
      expect(screen.queryByText("Account A secret question")).not.toBeInTheDocument();
      expect(screen.queryByText("Account A paid explanation")).not.toBeInTheDocument();
      expect(screen.getByText("Account B question")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /start 5-question practice/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /get pmle pass/i })).toBeInTheDocument();
    });
    it("requests ten questions and reports ten in analytics for paid practice", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: { id: "paid-a" }, isLoading: false });
      (global.fetch as jest.Mock).mockReset().mockImplementation((url: string) => Promise.resolve({
        ok: true, status: 200, json: async () => url.includes("/api/billing/status") ? { isSubscriber: true }
          : url.includes("/api/practice/session") ? { sessionId: "practice-paid", route: "/practice/session/practice-paid", questionCount: 10 }
          : mockSuccessResponse,
      }));
      render(<DiagnosticSummaryPage />);
      fireEvent.click(await screen.findByRole("button", { name: /start 10-question practice/i }));
      await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/practice/session/practice-paid"));
      const practiceCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === "/api/practice/session");
      expect(JSON.parse(practiceCall[1].body).questionCount).toBe(10);
      expect(mockPostHog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.STUDY_PLAN_START_PRACTICE_CLICKED,
        expect.objectContaining({ questionCount: 10 }));
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

      const domainHeading = await screen.findByRole("heading", { name: /^domain performance$/i });
      expect(domainHeading).toBeInTheDocument();
      expect(screen.getAllByText(/Architecting Low-Code ML Solutions/i).length).toBeGreaterThan(0);
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
      mockPostHog.getFeatureFlag.mockReturnValue("control");

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(mockPostHog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.DIAGNOSTIC_SUMMARY_VIEWED, {
          sessionId: "test-session-123",
          examType: "Google Professional ML Engineer",
          examKey: "pmle",
          score: 70,
          totalQuestions: 10,
          correctAnswers: 7,
          domainCount: 2,
          readinessTier: expect.any(String),
          verdict_copy_variant: expect.any(String),
        });
      });
    });

    it("should include verdict_copy_variant in signup CTA click event", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      mockPostHog.getFeatureFlag.mockReturnValue("risk_qualifier");

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save my results/i })).toBeInTheDocument();
      });

      const signupButton = screen.getByRole("button", { name: /save my results/i });
      fireEvent.click(signupButton);

      await waitFor(() => {
        expect(mockPostHog.capture).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.DIAGNOSTIC_SUMMARY_SIGNUP_CTA_CLICKED,
          expect.objectContaining({
            verdict_copy_variant: "risk_qualifier",
          })
        );
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

    it("should initialize upsell hook with score", async () => {
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

        // Wait for summary to load
        await waitFor(() => {
          expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
        });

        // Verify useUpsell was called with the score
        expect(useUpsell).toHaveBeenCalledWith(
          expect.objectContaining({
            score: 85,
          })
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it("should track domain click with correct properties", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /^domain performance$/i })).toBeInTheDocument();
      });

      // Find and click a domain row - look for clickable domain elements
      const domainTexts = screen.getAllByText(/Architecting Low-Code ML Solutions/i);
      expect(domainTexts.length).toBeGreaterThan(0);
      
      // Find the parent clickable div
      const domainRow = domainTexts[0].closest('div[class*="cursor-pointer"]');
      expect(domainRow).not.toBeNull();
      
      if (domainRow) {
        fireEvent.click(domainRow);
        
        await waitFor(() => {
          expect(mockPostHog.capture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.DIAGNOSTIC_DOMAIN_CLICKED,
            expect.objectContaining({
              sessionId: "test-session-123",
              examKey: "pmle",
              domainCode: expect.any(String),
              domainTier: expect.any(String),
            })
          );
        });
      }
    });

    it("should track study plan CTA click with domain_row source", async () => {
      const mockPracticeResponse = {
        sessionId: "practice-session-domain",
        route: "/practice?sessionId=practice-session-domain",
        questionCount: 5,
      };

      mockSummaryAndPractice(mockSuccessResponse, {
        ok: true, status: 200, json: async () => mockPracticeResponse,
      });

      (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" }, isLoading: false });
      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        const studyPlanHeadings = screen.getAllByText(/study plan/i);
        expect(studyPlanHeadings.length).toBeGreaterThan(0);
      });

      const studyPlanButtons = screen.getAllByRole("button", { 
        name: /start practice \(5\)/i
      });
      
      expect(studyPlanButtons.length).toBeGreaterThan(0);
      fireEvent.click(studyPlanButtons[0]);

      await waitFor(() => {
        expect(mockPostHog.capture).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.STUDY_PLAN_START_PRACTICE_CLICKED,
          expect.objectContaining({
            sessionId: "test-session-123",
            examKey: "pmle",
            domainCodes: expect.any(Array),
            questionCount: 5,
            source: "domain_row",
          })
        );
      });
    });

    it("should track question explanation viewed", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" }, isLoading: false });

      (global.fetch as jest.Mock).mockReset()
        .mockImplementation((url: string) => Promise.resolve({
          ok: true, status: 200,
          json: async () => url.includes("/api/billing/status")
            ? { isSubscriber: true } : mockSuccessResponse,
        }));
      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        const questionReviewHeadings = screen.getAllByText(/question review/i);
        expect(questionReviewHeadings.length).toBeGreaterThan(0);
      });

      // Find and click a "View explanation" button
      const viewExplanationButtons = screen.getAllByText(/view explanation/i);
      expect(viewExplanationButtons.length).toBeGreaterThan(0);
      fireEvent.click(viewExplanationButtons[0]);

      await waitFor(() => {
        expect(mockPostHog.capture).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.QUESTION_EXPLANATION_VIEWED,
          expect.objectContaining({
            sessionId: "test-session-123",
            examKey: "pmle",
            questionId: expect.any(String),
            domain: expect.any(String),
            isCorrect: expect.any(Boolean),
          })
        );
      });
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
        questionCount: 5,
      };

      mockSummaryAndPractice(mockSuccessResponse, {
        ok: true, status: 200, json: async () => mockPracticeResponse,
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole("button", { 
        name: /start 5-question practice on your weakest topics/i
      });
      fireEvent.click(practiceButton);

      await waitFor(() => {
        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        const practiceCall = fetchCalls.find((call: any[]) => 
          call[0]?.includes("/api/practice/session")
        );
        expect(practiceCall).toBeDefined();
        expect(practiceCall[1]).toMatchObject({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const body = JSON.parse(practiceCall[1].body);
        expect(body).toMatchObject({
          examKey: "pmle",
          questionCount: 5,
          source: "diagnostic_summary",
          sourceSessionId: "test-session-123",
        });
        expect(Array.isArray(body.domainCodes)).toBe(true);
        expect(body.domainCodes.length).toBeGreaterThan(0);
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith("/practice?sessionId=practice-session-456");
      });

      expect(mockPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.PRACTICE_SESSION_CREATED_FROM_DIAGNOSTIC,
        expect.objectContaining({
          diagnosticSessionId: "test-session-123",
          practiceSessionId: "practice-session-456",
          examKey: "pmle",
          domainCodes: expect.any(Array),
          questionCount: 5,
        })
      );
      
      // Verify study_plan_start_practice_clicked was also fired
      expect(mockPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.STUDY_PLAN_START_PRACTICE_CLICKED,
        expect.objectContaining({
          sessionId: "test-session-123",
          examKey: "pmle",
          domainCodes: expect.any(Array),
          questionCount: 5,
          source: "weakest",
        })
      );
    });

    it("should create practice session from Study Plan CTA with single domain", async () => {
      const mockPracticeResponse = {
        sessionId: "practice-session-789",
        route: "/practice?sessionId=practice-session-789",
        questionCount: 5,
      };

      mockSummaryAndPractice(mockSuccessResponse, {
        ok: true, status: 200, json: async () => mockPracticeResponse,
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/study plan/i)).toBeInTheDocument();
      });

      const studyPlanButtons = screen.getAllByRole("button", { 
        name: /start practice \(5\)/i
      });
      
      if (studyPlanButtons.length > 0) {
        fireEvent.click(studyPlanButtons[0]);

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledWith(
            "/api/practice/session",
            expect.objectContaining({
              method: "POST",
              body: expect.stringContaining('"questionCount":5'),
            })
          );
        });

        await waitFor(() => {
          expect(mockRouter.push).toHaveBeenCalledWith("/practice?sessionId=practice-session-789");
        });
      }
    });

    it("should show error toast when practice session creation fails", async () => {
      mockSummaryAndPractice(mockSuccessResponse, {
        ok: false, status: 500,
        json: async () => ({ error: "Failed to create practice session" }),
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole("button", { 
        name: /start 5-question practice on your weakest topics/i
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
        ANALYTICS_EVENTS.PRACTICE_SESSION_CREATION_FAILED_FROM_DIAGNOSTIC,
        expect.objectContaining({
          diagnosticSessionId: "test-session-123",
          statusCode: 500,
        })
      );
      
      // Verify study_plan_start_practice_clicked was still fired before the error
      expect(mockPostHog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.STUDY_PLAN_START_PRACTICE_CLICKED,
        expect.objectContaining({
          sessionId: "test-session-123",
          examKey: "pmle",
          source: "weakest",
        })
      );
    });

    it("should handle network errors gracefully", async () => {
      mockSummaryAndPractice(mockSuccessResponse, new Error("Network error"));

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole("button", { 
        name: /start 5-question practice on your weakest topics/i
      });
      fireEvent.click(practiceButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("does not let a client paywall trigger block free-quota session creation", async () => {
      mockTriggers.checkPaywallTrigger.mockReturnValue(true);
      mockSummaryAndPractice(mockSuccessResponse, {
        ok: true, status: 200, json: async () => ({ sessionId: "quota-session", route: "/practice/session/quota-session" }),
      });
      render(<DiagnosticSummaryPage />);
      const practiceButton = await screen.findByRole("button", {
        name: /start 5-question practice on your weakest topics/i,
      });
      fireEvent.click(practiceButton);
      await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/practice/session/quota-session"));
      expect(mockTriggers.checkPaywallTrigger).not.toHaveBeenCalled();
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
        questionCount: 5,
      };

      mockSummaryAndPractice(mockResponseWithWeakDomains, {
        ok: true, status: 200, json: async () => mockPracticeResponse,
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      const practiceButton = screen.getByRole("button", { 
        name: /start 5-question practice on your weakest topics/i
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
      (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" }, isLoading: false });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/what is machine learning/i)).toBeInTheDocument();
        expect(screen.getByText(/what is deep learning/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Correct/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Incorrect/).length).toBeGreaterThan(0);
      });
    });

    it("should highlight user answers and correct answers", async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-123" }, isLoading: false });

      (global.fetch as jest.Mock).mockReset()
        .mockImplementation((url: string) => Promise.resolve({
          ok: true, status: 200,
          json: async () => url.includes("/api/billing/status")
            ? { isSubscriber: true } : mockSuccessResponse,
        }));
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

      expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/diagnostic/summary"));
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

  it("renders anonymous aggregate-only summaries with an account CTA and no questions", async () => {
    const { questions: _questions, ...basicSummary } = mockSuccessResponse.summary;
    void _questions;
    mockSummaryAndPractice({ ...mockSuccessResponse, summary: basicSummary }, {});
    render(<DiagnosticSummaryPage />);
    const domainHeading = await screen.findByRole("heading", { name: /^domain performance$/i });
    expect(domainHeading.closest(".blur-sm")).toBeNull();
    expect(screen.getByText(/readiness:/i)).toBeInTheDocument();
    expect(screen.queryByText("What is machine learning?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sign up free/i }));
    expect(mockRouter.push).toHaveBeenCalledWith("/signup");
  });

  describe("Anonymous user gating", () => {
    beforeEach(() => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
      // Mock billing status API to return ANONYMOUS access level
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/api/billing/status")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ isSubscriber: false }),
          });
        }
        if (url.includes("/api/diagnostic/summary")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockSuccessResponse,
          });
        }
        return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
      });
    });

    it("should show verdict block for anonymous users", async () => {
      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
        expect(screen.getByText(/readiness:/i)).toBeInTheDocument();
        expect(screen.getAllByText(/70\s*%/)[0]).toBeInTheDocument();
      });
    });

    it("shows unblurred Domain Performance but account-gates question review", async () => {
      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /^domain performance$/i })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /^study plan$/i })).toBeInTheDocument();
      });

      const domainSection = screen.getByRole("heading", { name: /^domain performance$/i });
      expect(domainSection.closest(".blur-sm")).toBeNull();
      expect(screen.queryByText("What is machine learning?")).not.toBeInTheDocument();
      // Question review and study plan remain account-gated.
      const lockIcons = screen.getAllByText(/sign up free to unlock/i);
      expect(lockIcons.length).toBeGreaterThan(0);
    });

    it("should show signup panel for anonymous users", async () => {
      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/create a free account to review your questions/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /sign up free/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /continue without account/i })).toBeInTheDocument();
      });
    });

    it("should track gated view event for anonymous users", async () => {
      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(mockPostHog.capture).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.DIAGNOSTIC_SUMMARY_GATED_VIEWED,
          expect.objectContaining({
            sessionId: "test-session-123",
            examKey: "pmle",
            score: 70,
            examType: "Google Professional ML Engineer",
            source: "diagnostic_summary",
          })
        );
      });
    });

    it("should track signup CTA click and navigate to signup", async () => {
      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /sign up free/i })).toBeInTheDocument();
      });

      const signupButton = screen.getByRole("button", { name: /sign up free/i });
      fireEvent.click(signupButton);

      await waitFor(() => {
        expect(mockPostHog.capture).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.DIAGNOSTIC_SUMMARY_SIGNUP_CTA_CLICKED,
          expect.objectContaining({
            sessionId: "test-session-123",
            examKey: "pmle",
            accessLevel: "ANONYMOUS",
            source: "diagnostic_summary_anonymous",
          })
        );
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/signup"
        );
      });
    });

    it("should hide signup panel when 'Continue without account' is clicked", async () => {
      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /continue without account/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole("button", { name: /continue without account/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.queryByText(/create a free account to review your questions/i)).not.toBeInTheDocument();
      });
    });

    it("should not show trial CTA for anonymous users", async () => {
      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      // Trial CTA should not be visible for anonymous users
      expect(screen.queryByText(/ready to pass/i)).not.toBeInTheDocument();
    });
  });

  describe("A/B Test: Verdict Copy Variants", () => {
    beforeEach(() => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    });

    it("should render control variant with standard readiness label", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue("control");

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      // Should show standard "Readiness: Building" (score is 70, which maps to "Ready" tier)
      expect(screen.getByText(/readiness: ready/i)).toBeInTheDocument();
      expect(screen.getByText(/pass typically ≥70%/i)).toBeInTheDocument();
      // Should NOT show risk qualifier
      expect(screen.queryByText(/with risk/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/but exposed in/i)).not.toBeInTheDocument();
    });

    it("should render treatment variant with risk qualifier for Ready tier", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue("risk_qualifier");
      
      const readyScoreResponse = {
        ...mockSuccessResponse,
        summary: { ...mockSuccessResponse.summary, score: 75 }, // Ready tier (70-84)
        domainBreakdown: [
          { domain: "Architecting Low-Code ML Solutions", correct: 2, total: 5, percentage: 40 },
          { domain: "Collaborating to Manage Data & Models", correct: 3, total: 5, percentage: 60 },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => readyScoreResponse,
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      // Should show "Ready — with risk"
      expect(screen.getByText(/readiness: ready — with risk/i)).toBeInTheDocument();
      // Should show risk qualifier with weakest domains
      expect(screen.getByText(/but exposed in/i)).toBeInTheDocument();
      expect(screen.getAllByText(/architecting low-code ml solutions/i)[0]).toBeInTheDocument();
      // Should show action line
      expect(screen.getByText(/your biggest score lift is in/i)).toBeInTheDocument();
    });

    it("should render treatment variant for Borderline tier with action line", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue("risk_qualifier");
      
      const borderlineScoreResponse = {
        ...mockSuccessResponse,
        summary: { ...mockSuccessResponse.summary, score: 65 }, // Borderline (60-69)
        domainBreakdown: [
          { domain: "Architecting Low-Code ML Solutions", correct: 1, total: 5, percentage: 20 },
          { domain: "Collaborating to Manage Data & Models", correct: 3, total: 5, percentage: 60 },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => borderlineScoreResponse,
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      // Should show standard "Readiness: Building" (not "Ready — with risk" for Borderline)
      expect(screen.getByText(/readiness: building/i)).toBeInTheDocument();
      // Should still show action line
      expect(screen.getByText(/your biggest score lift is in/i)).toBeInTheDocument();
      expect(screen.getAllByText(/architecting low-code ml solutions/i)[0]).toBeInTheDocument();
    });

    it("should handle missing domain breakdown gracefully in treatment variant", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue("risk_qualifier");
      
      const noDomainResponse = {
        ...mockSuccessResponse,
        summary: { ...mockSuccessResponse.summary, score: 75 },
        domainBreakdown: [], // No domain breakdown
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => noDomainResponse,
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      // Should show standard "Ready" without risk qualifier when domain data is absent
      expect(screen.getByText(/^readiness: ready$/i)).toBeInTheDocument();
      // Should NOT show risk qualifier lines (no domain data)
      expect(screen.queryByText(/but exposed in/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/your biggest score lift is in/i)).not.toBeInTheDocument();
    });

    it("should default to control when feature flag returns false", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue(false);

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      // Should show standard label
      expect(screen.getByText(/readiness: ready/i)).toBeInTheDocument();
      expect(screen.queryByText(/with risk/i)).not.toBeInTheDocument();
    });
  });

  describe("A/B Test: Signup Module Copy Variants", () => {
    beforeEach(() => {
      (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    });

    it("should render control variant with original signup module copy", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue("control");

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      // Should show original signup module copy
      expect(screen.getByText(/create a free account to review your questions/i)).toBeInTheDocument();
      expect(screen.getByText(/your score and domain performance are free/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign up free/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /continue without account/i })).toBeInTheDocument();
      
      // Should NOT show treatment copy
      expect(screen.queryByText(/save your results/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/keep your domain breakdown/i)).not.toBeInTheDocument();
    });

    it("should render treatment variant with 'Save your results' copy", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue("risk_qualifier");

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic results/i)).toBeInTheDocument();
      });

      // Should show treatment signup module copy
      expect(screen.getByText(/save your results \(recommended\)/i)).toBeInTheDocument();
      expect(screen.getByText(/keep your domain breakdown \+ weak topics/i)).toBeInTheDocument();
      expect(screen.getByText(/get a personalized study plan/i)).toBeInTheDocument();
      expect(screen.getByText(/review missed questions anytime/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save my results/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /continue without saving/i })).toBeInTheDocument();
      expect(screen.getByText(/an account lets you save results and review your questions/i)).toBeInTheDocument();
      
      // Should NOT show control copy
      expect(screen.queryByText(/create a free account to unlock/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^sign up free$/i })).not.toBeInTheDocument();
    });

    it("should set attribution marker when signup CTA is clicked (treatment variant)", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue("risk_qualifier");
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

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save my results/i })).toBeInTheDocument();
      });

      const signupButton = screen.getByRole("button", { name: /save my results/i });
      fireEvent.click(signupButton);

      await waitFor(() => {
        // Verify attribution marker was set
        expect(localStorageMock.setItem).toHaveBeenCalledWith('signup_attribution_source', 'diagnostic_summary');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('signup_attribution_variant', 'risk_qualifier');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('signup_attribution_sessionId', 'test-session-123');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('signup_attribution_timestamp', expect.any(String));
        
        // Verify analytics event includes variant
        expect(mockPostHog.capture).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.DIAGNOSTIC_SUMMARY_SIGNUP_CTA_CLICKED,
          expect.objectContaining({
            signup_module_copy_variant: 'risk_qualifier',
            verdict_copy_variant: 'risk_qualifier',
          })
        );
      });
    });

    it("should set attribution marker when signup CTA is clicked (control variant)", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue("control");
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

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /sign up free/i })).toBeInTheDocument();
      });

      const signupButton = screen.getByRole("button", { name: /sign up free/i });
      fireEvent.click(signupButton);

      await waitFor(() => {
        // Verify attribution marker was set with control variant
        expect(localStorageMock.setItem).toHaveBeenCalledWith('signup_attribution_variant', 'control');
        
        // Verify analytics event includes variant
        expect(mockPostHog.capture).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.DIAGNOSTIC_SUMMARY_SIGNUP_CTA_CLICKED,
          expect.objectContaining({
            signup_module_copy_variant: 'control',
            verdict_copy_variant: 'control',
          })
        );
      });
    });

    it("should track 'continue without saving' click with variant", async () => {
      mockPostHog.getFeatureFlag.mockReturnValue("risk_qualifier");

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /continue without saving/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole("button", { name: /continue without saving/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockPostHog.capture).toHaveBeenCalledWith(
          ANALYTICS_EVENTS.DIAGNOSTIC_SUMMARY_SIGNUP_CTA_CLICKED,
          expect.objectContaining({
            source: "diagnostic_summary_continue_without",
            signup_module_copy_variant: 'risk_qualifier',
            verdict_copy_variant: 'risk_qualifier',
            action: "continue_without_saving",
          })
        );
      });

      // Panel should be hidden
      expect(screen.queryByText(/save your results/i)).not.toBeInTheDocument();
    });
  });

  describe("Logged-in user access (FREE and SUBSCRIBER)", () => {
    it("should show full content for FREE users", async () => {
      (useAuth as jest.Mock).mockReturnValue({ 
        user: { id: "user-123", email: "test@example.com" }, 
        isLoading: false 
      });
      
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/api/billing/status")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ isSubscriber: false }),
          });
        }
        if (url.includes("/api/diagnostic/summary")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockSuccessResponse,
          });
        }
        return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /^domain performance$/i })).toBeInTheDocument();
        expect(screen.getByText(/study plan/i)).toBeInTheDocument();
        expect(screen.getByText(/question review/i)).toBeInTheDocument();
      });

      // Should not show lock overlays
      expect(screen.queryByText(/sign up free to unlock/i)).not.toBeInTheDocument();
      // Should not show signup panel
      expect(screen.queryByText(/create a free account to unlock/i)).not.toBeInTheDocument();
    });

    it("should show full content for SUBSCRIBER users", async () => {
      (useAuth as jest.Mock).mockReturnValue({ 
        user: { id: "user-456", email: "subscriber@example.com" }, 
        isLoading: false 
      });
      
      (global.fetch as jest.Mock).mockReset().mockImplementation((url: string) => {
        if (url.includes("/api/billing/status")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ isSubscriber: true }),
          });
        }
        if (url.includes("/api/diagnostic/summary")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockSuccessResponse,
          });
        }
        return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
      });

      render(<DiagnosticSummaryPage />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /^domain performance$/i })).toBeInTheDocument();
        expect(screen.getByText(/study plan/i)).toBeInTheDocument();
        expect(screen.getByText(/question review/i)).toBeInTheDocument();
      });

      // Should not show lock overlays
      expect(screen.queryByText(/sign up free to unlock/i)).not.toBeInTheDocument();
      // Should not show signup panel
      expect(screen.queryByText(/create a free account to unlock/i)).not.toBeInTheDocument();
    });
  });
});
