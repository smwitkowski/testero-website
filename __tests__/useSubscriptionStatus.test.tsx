/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { useAuth } from "@/components/providers/AuthProvider";
import type { BillingStatusResponse } from "@/app/api/billing/status/route";

// Mock dependencies
jest.mock("@/components/providers/AuthProvider");
jest.mock("@/app/api/billing/status/route", () => ({
  // We'll mock the API endpoint directly in tests
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock global fetch
global.fetch = jest.fn();

describe("useSubscriptionStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    // Reset fetch mock to undefined by default
    (global.fetch as jest.Mock).mockReset();
  });

  describe("initial value provided", () => {
    it("should return initial value without fetching", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123" },
        session: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      const initialValue: BillingStatusResponse = {
        isSubscriber: true,
        status: "active",
      };

      const { result } = renderHook(() =>
        useSubscriptionStatus({ initial: initialValue })
      );

      // Should immediately return initial value
      expect(result.current.isSubscriber).toBe(true);
      expect(result.current.status).toBe("active");
      expect(result.current.isLoading).toBe(false);

      // Should not fetch
      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });
  });

  describe("fetching on mount", () => {
    it("should fetch /api/billing/status when no initial value provided", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123" },
        session: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      const mockResponse: BillingStatusResponse = {
        isSubscriber: true,
        status: "active",
      };

      (global.fetch as jest.Mock) = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useSubscriptionStatus());

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSubscriber).toBe(true);
      expect(result.current.status).toBe("active");
      expect(global.fetch).toHaveBeenCalledWith("/api/billing/status");
    });

    it("should handle fetch errors gracefully", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123" },
        session: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      (global.fetch as jest.Mock) = jest.fn().mockRejectedValueOnce(
        new Error("Network error")
      );

      const { result } = renderHook(() => useSubscriptionStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should default to non-subscriber on error
      expect(result.current.isSubscriber).toBe(false);
      expect(result.current.status).toBe("none");
    });
  });

  describe("re-fetching on auth changes", () => {
    it("should re-fetch when user ID changes", async () => {
      const mockResponse1: BillingStatusResponse = {
        isSubscriber: true,
        status: "active",
      };
      const mockResponse2: BillingStatusResponse = {
        isSubscriber: false,
        status: "none",
      };

      // Start with user-123
      mockUseAuth.mockReturnValue({
        user: { id: "user-123" },
        session: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      (global.fetch as jest.Mock) = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2,
        });

      const { result, rerender } = renderHook(() => useSubscriptionStatus());

      await waitFor(() => {
        expect(result.current.isSubscriber).toBe(true);
      });

      // Change user to user-456
      mockUseAuth.mockReturnValue({
        user: { id: "user-456" },
        session: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      rerender();

      await waitFor(() => {
        expect(result.current.isSubscriber).toBe(false);
        expect(result.current.status).toBe("none");
      });

      // Should have been called twice (initial + re-fetch)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should re-fetch when user logs in (null to user)", async () => {
      // Start unauthenticated - with initial, no fetch should happen
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      // When unauthenticated and no initial, should fetch and get none
      (global.fetch as jest.Mock) = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSubscriber: false, status: "none" }),
      });

      const { result, rerender } = renderHook(() => useSubscriptionStatus());

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isSubscriber).toBe(false);
        expect(result.current.status).toBe("none");
      });

      // User logs in
      const mockResponse: BillingStatusResponse = {
        isSubscriber: true,
        status: "active",
      };

      mockUseAuth.mockReturnValue({
        user: { id: "user-123" },
        session: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      (global.fetch as jest.Mock) = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.isSubscriber).toBe(true);
        expect(result.current.status).toBe("active");
      });
    });
  });

  describe("refetch function", () => {
    it("should expose refetch function that manually triggers fetch", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123" },
        session: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      const mockResponse1: BillingStatusResponse = {
        isSubscriber: false,
        status: "none",
      };
      const mockResponse2: BillingStatusResponse = {
        isSubscriber: true,
        status: "active",
      };

      (global.fetch as jest.Mock) = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2,
        });

      const { result } = renderHook(() => useSubscriptionStatus());

      await waitFor(() => {
        expect(result.current.isSubscriber).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });

      // Manually refetch
      result.current.refetch();

      // Wait for refetch to complete
      await waitFor(() => {
        expect(result.current.isSubscriber).toBe(true);
        expect(result.current.status).toBe("active");
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 3000 });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("return shape", () => {
    it("should expose only isSubscriber, status, isLoading, and refetch", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "user-123" },
        session: null,
        isLoading: false,
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      } as any);

      (global.fetch as jest.Mock) = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isSubscriber: true,
          status: "active",
        }),
      });

      const { result } = renderHook(() => useSubscriptionStatus());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check return shape - should only have these keys
      const keys = Object.keys(result.current);
      expect(keys.sort()).toEqual(["isLoading", "isSubscriber", "refetch", "status"]);
    });
  });
});

