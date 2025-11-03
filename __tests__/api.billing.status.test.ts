/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/billing/status/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Mock the dependencies
jest.mock("@/lib/supabase/server");

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<
  typeof createServerSupabaseClient
>;

describe("GET /api/billing/status", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    };

    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase);
  });

  describe("Unauthenticated users", () => {
    it("should return isSubscriber:false and status:none for unauthenticated users", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/api/billing/status");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isSubscriber: false,
        status: "none",
      });
      // Ensure no sensitive data is leaked
      expect(Object.keys(data)).toEqual(["isSubscriber", "status"]);
    });
  });

  describe("Authenticated users", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };

    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it("should return isSubscriber:false and status:none when user has no subscription", async () => {
      // Both queries return no results
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

      const req = new NextRequest("http://localhost:3000/api/billing/status");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isSubscriber: false,
        status: "none",
      });
      expect(Object.keys(data)).toEqual(["isSubscriber", "status"]);
    });

    it("should return isSubscriber:true and status:active for active subscription", async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          status: "active",
          trial_ends_at: null,
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/api/billing/status");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isSubscriber: true,
        status: "active",
      });
      expect(Object.keys(data)).toEqual(["isSubscriber", "status"]);
    });

    it("should return isSubscriber:true and status:trialing for valid trialing subscription", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          status: "trialing",
          trial_ends_at: futureDate.toISOString(),
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/api/billing/status");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isSubscriber: true,
        status: "trialing",
      });
      expect(Object.keys(data)).toEqual(["isSubscriber", "status"]);
    });

    it("should return isSubscriber:false and status:trialing for expired trialing subscription", async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          status: "trialing",
          trial_ends_at: pastDate.toISOString(),
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/api/billing/status");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isSubscriber: false,
        status: "trialing",
      });
      expect(Object.keys(data)).toEqual(["isSubscriber", "status"]);
    });

    it("should return isSubscriber:false and status:past_due for past_due subscription", async () => {
      // First query (active/trialing) returns no results
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        // Second query (any status) returns past_due
        .mockResolvedValueOnce({
          data: {
            status: "past_due",
            trial_ends_at: null,
          },
          error: null,
        });

      // Mock order() for the second query
      mockSupabase.order = jest.fn().mockReturnThis();

      const req = new NextRequest("http://localhost:3000/api/billing/status");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isSubscriber: false,
        status: "past_due",
      });
      expect(Object.keys(data)).toEqual(["isSubscriber", "status"]);
    });

    it("should return isSubscriber:false and status:canceled for canceled subscription", async () => {
      // First query (active/trialing) returns no results
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({
          data: null,
          error: null,
        })
        // Second query (any status) returns canceled
        .mockResolvedValueOnce({
          data: {
            status: "canceled",
            trial_ends_at: null,
          },
          error: null,
        });

      // Mock order() for the second query
      mockSupabase.order = jest.fn().mockReturnThis();

      const req = new NextRequest("http://localhost:3000/api/billing/status");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        isSubscriber: false,
        status: "canceled",
      });
      expect(Object.keys(data)).toEqual(["isSubscriber", "status"]);
    });

    it("should only select status and trial_ends_at fields (no sensitive data)", async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          status: "active",
          trial_ends_at: null,
        },
        error: null,
      });

      const req = new NextRequest("http://localhost:3000/api/billing/status");
      await GET(req);

      expect(mockSupabase.select).toHaveBeenCalledWith("status, trial_ends_at");
      expect(mockSupabase.from).toHaveBeenCalledWith("user_subscriptions");
      expect(mockSupabase.eq).toHaveBeenCalledWith("user_id", mockUser.id);
      expect(mockSupabase.in).toHaveBeenCalledWith("status", ["active", "trialing"]);
    });
  });
});

