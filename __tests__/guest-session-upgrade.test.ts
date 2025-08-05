/**
 * @jest-environment jsdom
 */

import { signupBusinessLogic } from "@/lib/auth/signup-handler";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock crypto.randomUUID for consistent testing
const mockUUID = "test-uuid-1234-5678-9abc-def012345678";
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: jest.fn(() => mockUUID),
  },
});

describe("Guest Session Upgrade", () => {
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;
  let mockAnalytics: jest.Mocked<{ capture: jest.Mock }>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Rate limiting is now handled at API route level

    // Mock analytics
    mockAnalytics = {
      capture: jest.fn(),
    };

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        signUp: jest.fn(),
      },
      from: jest.fn(),
    } as any;

    // Default successful signup response
    (mockSupabaseClient.auth.signUp as jest.Mock).mockResolvedValue({
      data: {
        user: { id: "user_12345", email: "test@example.com" },
        session: null,
      },
      error: null,
    });
  });

  describe("signupBusinessLogic with guest upgrade", () => {
    test("should upgrade guest sessions when anonymousSessionId is provided", async () => {
      const anonymousSessionId = "anon-session-123";
      const mockSessions = [
        {
          id: "session_1",
          exam_type: "Google ML Engineer",
          started_at: "2025-01-01T10:00:00Z",
          completed_at: "2025-01-01T11:00:00Z",
          question_count: 5,
        },
        {
          id: "session_2",
          exam_type: "Google Cloud Architect",
          started_at: "2025-01-02T10:00:00Z",
          completed_at: null,
          question_count: 3,
        },
      ];

      // Mock Supabase from() chain for fetching anonymous sessions
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockIs = jest.fn().mockResolvedValue({
        data: mockSessions,
        error: null,
      });

      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        is: mockIs,
      });

      // Mock Supabase from() chain for updating sessions
      const mockUpdate = jest.fn().mockReturnThis();
      const mockEqUpdate = jest.fn().mockReturnThis();
      const mockIsUpdate = jest.fn().mockResolvedValue({
        error: null,
      });

      // Need to handle multiple from() calls
      (mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockReturnValueOnce({
          update: mockUpdate,
        });

      mockUpdate.mockReturnValue({
        eq: mockEqUpdate,
      });
      mockEqUpdate.mockReturnValue({
        is: mockIsUpdate,
      });

      const result = await signupBusinessLogic({
        email: "test@example.com",
        password: "password123",
        supabaseClient: mockSupabaseClient,
        analytics: mockAnalytics,
        anonymousSessionId,
      });

      // Verify signup was successful
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        status: "ok",
        guestUpgraded: true,
        sessionsTransferred: 2,
      });

      // Verify database operations
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("diagnostics_sessions");

      // Verify select query for fetching sessions
      expect(mockSelect).toHaveBeenCalledWith(
        "id, exam_type, started_at, completed_at, question_count"
      );
      expect(mockEq).toHaveBeenCalledWith("anonymous_session_id", anonymousSessionId);
      expect(mockIs).toHaveBeenCalledWith("user_id", null);

      // Verify update query for upgrading sessions
      expect(mockUpdate).toHaveBeenCalledWith({
        user_id: "user_12345",
        anonymous_session_id: null,
      });
      expect(mockEqUpdate).toHaveBeenCalledWith("anonymous_session_id", anonymousSessionId);
      expect(mockIsUpdate).toHaveBeenCalledWith("user_id", null);

      // Verify analytics events
      expect(mockAnalytics.capture).toHaveBeenCalledWith({
        event: "signup_attempt",
        properties: {
          email: "test@example.com",
          hasAnonymousSession: true,
        },
      });

      expect(mockAnalytics.capture).toHaveBeenCalledWith({
        event: "guest_upgraded",
        properties: {
          userId: "user_12345",
          sessionsTransferred: 2,
          completedSessions: 1,
          activeSessions: 1,
          totalQuestionsAnswered: 8,
          examTypes: ["Google ML Engineer", "Google Cloud Architect"],
          oldestSession: "2025-01-01T10:00:00Z",
        },
      });

      expect(mockAnalytics.capture).toHaveBeenCalledWith({
        event: "signup_success",
        properties: {
          email: "test@example.com",
          guestUpgraded: true,
          sessionsTransferred: 2,
        },
      });
    });

    test("should handle signup without anonymous session ID", async () => {
      const result = await signupBusinessLogic({
        email: "test@example.com",
        password: "password123",
        supabaseClient: mockSupabaseClient,
        analytics: mockAnalytics,
        // No anonymousSessionId provided
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        status: "ok",
      });

      // Verify analytics
      expect(mockAnalytics.capture).toHaveBeenCalledWith({
        event: "signup_attempt",
        properties: {
          email: "test@example.com",
          hasAnonymousSession: false,
        },
      });

      expect(mockAnalytics.capture).toHaveBeenCalledWith({
        event: "signup_success",
        properties: {
          email: "test@example.com",
          guestUpgraded: false,
          sessionsTransferred: 0,
        },
      });

      // Verify no database queries for session upgrade
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    test("should handle case with no anonymous sessions to upgrade", async () => {
      const anonymousSessionId = "anon-session-456";

      // Mock empty response for anonymous sessions
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockIs = jest.fn().mockResolvedValue({
        data: [], // No sessions found
        error: null,
      });

      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        is: mockIs,
      });

      const result = await signupBusinessLogic({
        email: "test@example.com",
        password: "password123",
        supabaseClient: mockSupabaseClient,
        analytics: mockAnalytics,
        anonymousSessionId,
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        status: "ok",
      });

      // Should not call guest_upgraded analytics event
      expect(mockAnalytics.capture).toHaveBeenCalledWith({
        event: "signup_success",
        properties: {
          email: "test@example.com",
          guestUpgraded: false,
          sessionsTransferred: 0,
        },
      });
    });

    test("should handle database error during session upgrade gracefully", async () => {
      const anonymousSessionId = "anon-session-789";

      // Mock database error during fetch
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockIs = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        is: mockIs,
      });

      const result = await signupBusinessLogic({
        email: "test@example.com",
        password: "password123",
        supabaseClient: mockSupabaseClient,
        analytics: mockAnalytics,
        anonymousSessionId,
      });

      // Signup should still succeed even if upgrade fails
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        status: "ok",
      });

      // Should track the upgrade error
      expect(mockAnalytics.capture).toHaveBeenCalledWith({
        event: "guest_upgrade_error",
        properties: {
          email: "test@example.com",
          error: "Database connection failed",
          anonymousSessionId: "anon-ses...",
        },
      });

      expect(mockAnalytics.capture).toHaveBeenCalledWith({
        event: "signup_success",
        properties: {
          email: "test@example.com",
          guestUpgraded: false,
          sessionsTransferred: 0,
        },
      });
    });

    test("should handle Supabase signup error", async () => {
      // Mock signup failure
      (mockSupabaseClient.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Email already registered" },
      });

      const result = await signupBusinessLogic({
        email: "test@example.com",
        password: "password123",
        supabaseClient: mockSupabaseClient,
        analytics: mockAnalytics,
        anonymousSessionId: "anon-session-999",
      });

      expect(result.status).toBe(400);
      expect(result.body).toEqual({
        error: "Request failed. Please try again.",
      });

      // Should track signup error
      expect(mockAnalytics.capture).toHaveBeenCalledWith({
        event: "signup_error",
        properties: {
          email: "test@example.com",
          error: "Email already registered",
        },
      });

      // Should not attempt session upgrade when signup fails
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    // Rate limiting test removed - now handled at API route level

    test("should handle invalid input validation", async () => {
      const result = await signupBusinessLogic({
        email: "invalid-email",
        password: "123", // Too short
        supabaseClient: mockSupabaseClient,
        analytics: mockAnalytics,
      });

      expect(result.status).toBe(400);
      expect(result.body).toEqual({
        error: "Invalid email or password",
      });

      // Should not call Supabase or analytics for invalid input
      expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
      expect(mockAnalytics.capture).not.toHaveBeenCalled();
    });
  });
});
