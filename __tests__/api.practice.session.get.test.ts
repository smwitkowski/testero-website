/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock the server-side dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn()
}));

describe('GET /api/practice/session/[sessionId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupMocks = (options: {
    user?: any;
    session?: any;
    questions?: any[];
    sessionError?: any;
    questionsError?: any;
  } = {}) => {
    const {
      user = { id: 'test-user' },
      session = {
        id: 'session-123',
        user_id: 'test-user',
        exam: 'pmle',
        created_at: '2024-01-01T00:00:00Z',
        question_count: 10,
        completed_at: null,
        source: 'dashboard',
        source_session_id: null,
      },
      questions = [
        {
          id: 'q1',
          stem: 'Test question 1',
          options: [
            { label: 'A', text: 'Option A' },
            { label: 'B', text: 'Option B' },
          ],
          correct_label: 'A',
        },
        {
          id: 'q2',
          stem: 'Test question 2',
          options: [
            { label: 'A', text: 'Option A' },
            { label: 'B', text: 'Option B' },
          ],
          correct_label: 'B',
        },
      ],
      sessionError = null,
      questionsError = null,
    } = options;

    const questionsQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: questions,
        error: questionsError,
      }),
    };

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
              error: sessionError,
            }),
          };
        }
        if (table === 'practice_questions') {
          return questionsQuery;
        }
        return {};
      }),
    };

    const { createServerSupabaseClient } = require('@/lib/supabase/server');
    createServerSupabaseClient.mockReturnValue(mockSupabase);

    return { mockSupabase };
  };

  it('should return session data for authenticated owner', async () => {
    setupMocks();

    const { GET } = require('@/app/api/practice/session/[sessionId]/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123');
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.session).toBeDefined();
    expect(body.session.id).toBe('session-123');
    expect(body.session.questions).toHaveLength(2);
    expect(body.session.questions[0].id).toBe('q1');
  });

  it('should return 401 for unauthenticated user', async () => {
    setupMocks({ user: null });

    const { GET } = require('@/app/api/practice/session/[sessionId]/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123');
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await GET(req, { params });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('should return 404 for non-existent session', async () => {
    setupMocks({
      sessionError: { code: 'PGRST116', message: 'No rows returned' },
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123');
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await GET(req, { params });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('Session not found.');
  });

  it('should return 403 for session owned by different user', async () => {
    setupMocks({
      session: {
        id: 'session-123',
        user_id: 'other-user',
        exam: 'pmle',
        created_at: '2024-01-01T00:00:00Z',
        question_count: 10,
        completed_at: null,
      },
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123');
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await GET(req, { params });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe('Unauthorized to access this session.');
  });

  it('should return 400 for already completed session', async () => {
    setupMocks({
      session: {
        id: 'session-123',
        user_id: 'test-user',
        exam: 'pmle',
        created_at: '2024-01-01T00:00:00Z',
        question_count: 10,
        completed_at: '2024-01-01T01:00:00Z',
      },
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123');
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await GET(req, { params });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Session already completed.');
  });

  it('should return 404 when no questions found', async () => {
    setupMocks({
      questions: [],
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123');
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await GET(req, { params });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('No questions found for this session.');
  });

  it('should return 400 for invalid session ID', async () => {
    setupMocks();

    const { GET } = require('@/app/api/practice/session/[sessionId]/route');
    const req = new NextRequest('http://localhost/api/practice/session/invalid');
    const params = Promise.resolve({ sessionId: '' });

    const res = await GET(req, { params });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid session ID provided');
  });
});

