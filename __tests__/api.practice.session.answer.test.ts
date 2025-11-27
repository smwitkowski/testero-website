/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock the server-side dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn()
}));

describe('POST /api/practice/session/[sessionId]/answer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupMocks = (options: {
    user?: any;
    session?: any;
    question?: any;
    existingResponse?: any;
    insertError?: any;
    updateError?: any;
  } = {}) => {
    const {
      user = { id: 'test-user' },
      session = {
        id: 'session-123',
        user_id: 'test-user',
        completed_at: null,
      },
      question = {
        id: 'q1',
        correct_label: 'A',
        session_id: 'session-123',
      },
      existingResponse = null,
      insertError = null,
      updateError = null,
    } = options;

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user },
          error: null,
        }),
      },
      from: jest.fn((table) => {
        if (table === 'practice_sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: session,
              error: null,
            }),
          };
        }
        if (table === 'practice_questions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: question,
              error: null,
            }),
          };
        }
        if (table === 'practice_responses') {
          const responsesQuery = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: existingResponse,
              error: existingResponse ? null : { code: 'PGRST116' },
            }),
            insert: jest.fn().mockResolvedValue({
              error: insertError,
            }),
            update: jest.fn().mockReturnThis(),
          };
          responsesQuery.update.mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: updateError,
            }),
          });
          return responsesQuery;
        }
        return {};
      }),
    };

    const { createServerSupabaseClient } = require('@/lib/supabase/server');
    createServerSupabaseClient.mockReturnValue(mockSupabase);

    return { mockSupabase };
  };

  it('should submit correct answer successfully', async () => {
    setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: 'q1',
        selectedLabel: 'A',
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.isCorrect).toBe(true);
    expect(body.correctLabel).toBe('A');
  });

  it('should submit incorrect answer successfully', async () => {
    setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: 'q1',
        selectedLabel: 'B',
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.isCorrect).toBe(false);
    expect(body.correctLabel).toBe('A');
  });

  it('should update existing response if already answered', async () => {
    setupMocks({
      existingResponse: {
        id: 'response-123',
        selected_label: 'B',
        is_correct: false,
      },
    });

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: 'q1',
        selectedLabel: 'A',
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.isCorrect).toBe(true);
    expect(body.updated).toBe(true);
  });

  it('should return 401 for unauthenticated user', async () => {
    setupMocks({ user: null });

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: 'q1',
        selectedLabel: 'A',
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('should return 400 for invalid question ID', async () => {
    setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: '',
        selectedLabel: 'A',
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid question ID');
  });

  it('should return 400 for invalid selected label', async () => {
    setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: 'q1',
        selectedLabel: 'Z',
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid selected label');
  });

  it('should return 403 for session owned by different user', async () => {
    setupMocks({
      session: {
        id: 'session-123',
        user_id: 'other-user',
        completed_at: null,
      },
    });

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: 'q1',
        selectedLabel: 'A',
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe('Unauthorized to access this session');
  });

  it('should return 400 for already completed session', async () => {
    setupMocks({
      session: {
        id: 'session-123',
        user_id: 'test-user',
        completed_at: '2024-01-01T01:00:00Z',
      },
    });

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: 'q1',
        selectedLabel: 'A',
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Session already completed');
  });

  it('should return 404 for question not in session', async () => {
    setupMocks({
      question: {
        id: 'q1',
        correct_label: 'A',
        session_id: 'other-session',
      },
    });

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: 'q1',
        selectedLabel: 'A',
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Question does not belong to this session');
  });

  it('should normalize selected label to uppercase', async () => {
    setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/answer/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/answer', {
      method: 'POST',
      body: JSON.stringify({
        questionId: 'q1',
        selectedLabel: 'a', // lowercase
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.isCorrect).toBe(true); // Should match 'A'
  });
});

