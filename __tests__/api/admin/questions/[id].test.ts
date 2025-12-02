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

jest.mock("@/lib/admin/questions/editor-query", () => ({
  fetchQuestionForEditor: jest.fn(),
  fetchDomainOptions: jest.fn(),
}));

jest.mock("@/lib/auth/isAdmin", () => ({
  isAdmin: jest.fn(),
}));

import { GET, PUT } from "@/app/api/admin/questions/[id]/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  fetchQuestionForEditor,
  fetchDomainOptions,
} from "@/lib/admin/questions/editor-query";
import { isAdmin } from "@/lib/auth/isAdmin";

describe("GET /api/admin/questions/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isAdmin as jest.Mock).mockImplementation((user) => {
      return user?.id === "admin-user" || user?.email === "admin@test.com";
    });
  });

  const setupMocks = (options: {
    user?: any;
    question?: any;
    domains?: any;
  } = {}) => {
    const {
      user = { id: "admin-user", email: "admin@test.com" },
      question = {
        id: "q1",
        stem: "Test question",
        domain_id: "domain-1",
      },
      domains = [{ id: "domain-1", code: "DOMAIN_A", name: "Domain A" }],
    } = options;

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
    };

    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    (fetchQuestionForEditor as jest.Mock).mockResolvedValue(question);
    (fetchDomainOptions as jest.Mock).mockResolvedValue(domains);

    return { mockSupabase, user, question, domains };
  };

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

    const request = new NextRequest("http://localhost/api/admin/questions/q1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("Forbidden");
  });

  it("should return 400 for invalid UUID", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/invalid");
    const response = await GET(request, {
      params: Promise.resolve({ id: "invalid-id" }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid question ID");
  });

  it("should return 404 when question not found", async () => {
    setupMocks();
    (fetchQuestionForEditor as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/admin/questions/q1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Question not found");
  });

  it("should return question and domains for admin user", async () => {
    const { question, domains } = setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/q1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.question).toEqual(question);
    expect(json.domains).toEqual(domains);
  });
});

describe("PUT /api/admin/questions/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isAdmin as jest.Mock).mockImplementation((user) => {
      return user?.id === "admin-user" || user?.email === "admin@test.com";
    });
  });

  const setupMocks = (options: {
    user?: any;
    updateError?: any;
    deleteError?: any;
    insertError?: any;
    upsertError?: any;
    updatedQuestion?: any;
  } = {}) => {
    const {
      user = { id: "admin-user", email: "admin@test.com" },
      updateError = null,
      deleteError = null,
      insertError = null,
      upsertError = null,
      updatedQuestion = {
        id: "q1",
        stem: "Updated question",
      },
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
            eq: jest.fn().mockResolvedValue({
              error: updateError,
            }),
          };
        }
        if (table === "answers") {
          return {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              error: deleteError,
            }),
            insert: jest.fn().mockResolvedValue({
              error: insertError,
            }),
          };
        }
        if (table === "explanations") {
          return {
            upsert: jest.fn().mockResolvedValue({
              error: upsertError,
            }),
          };
        }
        return {};
      }),
    };

    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    (createServiceSupabaseClient as jest.Mock).mockReturnValue(mockServiceSupabase);
    (fetchQuestionForEditor as jest.Mock).mockResolvedValue(updatedQuestion);

    return { mockSupabase, mockServiceSupabase, user, updatedQuestion };
  };

  const validPayload = {
    domain_id: "123e4567-e89b-12d3-a456-426614174000",
    difficulty: "MEDIUM" as const,
    status: "ACTIVE" as const,
    review_status: "GOOD" as const,
    review_notes: "Looks good",
    stem: "This is a test question stem that is long enough",
    answers: [
      { choice_label: "A" as const, choice_text: "Answer A", is_correct: true },
      { choice_label: "B" as const, choice_text: "Answer B", is_correct: false },
      { choice_label: "C" as const, choice_text: "Answer C", is_correct: false },
      { choice_label: "D" as const, choice_text: "Answer D", is_correct: false },
    ],
    explanation_text: "This is the explanation",
    doc_links: ["https://example.com/doc"],
  };

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

    const request = new NextRequest("http://localhost/api/admin/questions/q1", {
      method: "PUT",
      body: JSON.stringify(validPayload),
    });
    const response = await PUT(request, {
      params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    expect(response.status).toBe(403);
  });

  it("should return 400 for invalid payload", async () => {
    setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/q1", {
      method: "PUT",
      body: JSON.stringify({ invalid: "payload" }),
    });
    const response = await PUT(request, {
      params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid payload");
  });

  it("should successfully update question", async () => {
    const { updatedQuestion } = setupMocks();

    const request = new NextRequest("http://localhost/api/admin/questions/q1", {
      method: "PUT",
      body: JSON.stringify(validPayload),
    });
    const response = await PUT(request, {
      params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.question).toEqual(updatedQuestion);
  });

  it("should return 500 on question update error", async () => {
    setupMocks({ updateError: { message: "Update failed" } });

    const request = new NextRequest("http://localhost/api/admin/questions/q1", {
      method: "PUT",
      body: JSON.stringify(validPayload),
    });
    const response = await PUT(request, {
      params: Promise.resolve({ id: "123e4567-e89b-12d3-a456-426614174000" }),
    });

    expect(response.status).toBe(500);
  });
});
