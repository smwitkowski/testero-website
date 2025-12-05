/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

// Mock the server-side dependencies
jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/auth/isAdmin", () => ({
  isAdmin: jest.fn(),
}));

import { POST } from "@/app/api/admin/questions/bulk-update/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/auth/isAdmin";

describe("POST /api/admin/questions/bulk-update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isAdmin as jest.Mock).mockImplementation(async (user) => {
      return user?.id === "admin-user" || user?.email === "admin@test.com";
    });
  });

  const setupMocks = (options: {
    user?: any;
    updateError?: any;
    updatedData?: any;
  } = {}) => {
    const {
      user = { id: "admin-user", email: "admin@test.com" },
      updateError = null,
      updatedData = [
        { id: "123e4567-e89b-12d3-a456-426614174000" },
        { id: "123e4567-e89b-12d3-a456-426614174001" },
      ],
    } = options;

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
    };

    const mockServiceSupabase = {
      from: jest.fn((table) => {
        if (table === "questions") {
          return {
            update: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue({
              data: updatedData,
              error: updateError,
            }),
          };
        }
        return {};
      }),
    };

    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    (createServiceSupabaseClient as jest.Mock).mockReturnValue(mockServiceSupabase);

    return { mockSupabase, mockServiceSupabase, user };
  };

  const validIds = [
    "123e4567-e89b-12d3-a456-426614174000",
    "123e4567-e89b-12d3-a456-426614174001",
  ];

  it("should return 403 for non-admin user", async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "regular-user" } },
          error: null,
        }),
      },
    };
    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "review:GOOD",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Forbidden");
  });

  it("should return 400 for invalid payload - missing ids", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        action: "review:GOOD",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid payload");
  });

  it("should return 400 for invalid payload - empty ids array", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: [],
        action: "review:GOOD",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid payload");
  });

  it("should return 400 for invalid payload - invalid action", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "invalid:action",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid payload");
  });

  it("should return 400 for invalid payload - non-UUID ids", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: ["not-a-uuid", ...validIds],
        action: "review:GOOD",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid payload");
  });

  it("should return 400 for too many ids (>100)", async () => {
    setupMocks();
    const tooManyIds = Array.from({ length: 101 }, (_, i) =>
      `123e4567-e89b-12d3-a456-426614174${i.toString().padStart(3, "0")}`
    );

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: tooManyIds,
        action: "review:GOOD",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid payload");
  });

  it("should successfully update review:GOOD", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "review:GOOD",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(2);
    expect(json.column).toBe("review_status");
    expect(json.value).toBe("GOOD");
  });

  it("should successfully update review:NEEDS_ANSWER_FIX", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "review:NEEDS_ANSWER_FIX",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(2);
    expect(json.column).toBe("review_status");
    expect(json.value).toBe("NEEDS_ANSWER_FIX");
  });

  it("should successfully update review:NEEDS_EXPLANATION_FIX", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "review:NEEDS_EXPLANATION_FIX",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(2);
    expect(json.column).toBe("review_status");
    expect(json.value).toBe("NEEDS_EXPLANATION_FIX");
  });

  it("should successfully update review:RETIRED", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "review:RETIRED",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(2);
    expect(json.column).toBe("review_status");
    expect(json.value).toBe("RETIRED");
  });

  it("should successfully update status:ACTIVE", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "status:ACTIVE",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(2);
    expect(json.column).toBe("status");
    expect(json.value).toBe("ACTIVE");
  });

  it("should successfully update status:DRAFT", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "status:DRAFT",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(2);
    expect(json.column).toBe("status");
    expect(json.value).toBe("DRAFT");
  });

  it("should successfully update status:RETIRED", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "status:RETIRED",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(2);
    expect(json.column).toBe("status");
    expect(json.value).toBe("RETIRED");
  });

  it("should return 500 on database error", async () => {
    setupMocks({ updateError: { message: "Database connection failed" } });

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "review:GOOD",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Update failed");
  });

  it("should handle empty update result", async () => {
    setupMocks({ updatedData: [] });

    const request = new NextRequest("http://localhost/api/admin/questions/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ids: validIds,
        action: "review:GOOD",
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.updated).toBe(0);
    expect(json.column).toBe("review_status");
    expect(json.value).toBe("GOOD");
  });
});