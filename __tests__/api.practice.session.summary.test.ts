/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock the server-side dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn()
}));

jest.mock('@/lib/access/pmleEntitlements.server', () => ({
  getPmleAccessLevelForRequest: jest.fn()
}));

jest.mock('@/lib/access/pmleEntitlements', () => ({
  canUseFeature: jest.fn()
}));

jest.mock('@/lib/constants/pmle-blueprint', () => ({
  getPmleDomainConfig: jest.fn((code: string) => ({
    displayName: `Domain ${code}`,
    domainCode: code,
  })),
}));

describe('GET /api/practice/session/[sessionId]/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupMocks = (options: {
    user?: any;
    accessLevel?: string;
    canAccess?: boolean;
    session?: any;
    questions?: any[];
    explanations?: any[];
    sessionError?: any;
    questionsError?: any;
  } = {}) => {
    const {
      user = { id: 'test-user' },
      accessLevel = 'SUBSCRIBER',
      canAccess = true,
      session = {
        id: 'session-123',
        user_id: 'test-user',
        completed_at: '2024-01-01T01:00:00Z',
        exam: 'pmle',
        created_at: '2024-01-01T00:00:00Z',
        question_count: 2,
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
          canonical_question_id: 'canonical-q1',
          domain_code: 'D1',
          domain_id: 'domain-uuid-1',
          practice_responses: [
            {
              selected_label: 'A',
              is_correct: true,
              responded_at: '2024-01-01T00:30:00Z',
            },
          ],
        },
        {
          id: 'q2',
          stem: 'Test question 2',
          options: [
            { label: 'A', text: 'Option A' },
            { label: 'B', text: 'Option B' },
          ],
          correct_label: 'B',
          canonical_question_id: 'canonical-q2',
          domain_code: 'D1',
          domain_id: 'domain-uuid-1',
          practice_responses: [
            {
              selected_label: 'A',
              is_correct: false,
              responded_at: '2024-01-01T00:31:00Z',
            },
          ],
        },
      ],
      explanations = [
        { question_id: 'canonical-q1', explanation_text: 'Explanation 1' },
        { question_id: 'canonical-q2', explanation_text: 'Explanation 2' },
      ],
      sessionError = null,
      questionsError = null,
    } = options;

    const { getPmleAccessLevelForRequest } = require('@/lib/access/pmleEntitlements.server');
    getPmleAccessLevelForRequest.mockResolvedValue({ accessLevel, user });

    const { canUseFeature } = require('@/lib/access/pmleEntitlements');
    canUseFeature.mockImplementation((_level: string, feature: string) => {
      if (feature === 'PRACTICE_SESSION') return canAccess;
      if (feature === 'EXPLANATIONS') return canAccess && accessLevel === 'SUBSCRIBER';
      return false;
    });

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
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: questions,
              error: questionsError,
            }),
          };
        }
        if (table === 'explanations') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: explanations,
              error: null,
            }),
          };
        }
        return {};
      }),
    };

    const { createServerSupabaseClient } = require('@/lib/supabase/server');
    createServerSupabaseClient.mockReturnValue(mockSupabase);

    return { mockSupabase };
  };

  it('should return summary for completed session', async () => {
    setupMocks();

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.summary).toBeDefined();
    expect(body.summary.sessionId).toBe('session-123');
    expect(body.summary.score).toBe(50); // 1 out of 2 correct
    expect(body.summary.totalQuestions).toBe(2);
    expect(body.summary.correctAnswers).toBe(1);
    expect(body.summary.questions).toHaveLength(2);
    expect(body.domainBreakdown).toBeDefined();
  });

  it('should include explanations for subscribers', async () => {
    setupMocks({ accessLevel: 'SUBSCRIBER', canAccess: true });

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.summary.questions[0].explanation).toBe('Explanation 1');
    expect(body.summary.questions[1].explanation).toBe('Explanation 2');
  });

  it('should exclude explanations for non-subscribers', async () => {
    setupMocks({ accessLevel: 'FREE', canAccess: true });

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.summary.questions[0].explanation).toBeNull();
    expect(body.summary.questions[1].explanation).toBeNull();
  });

  it('should calculate domain breakdown correctly', async () => {
    setupMocks();

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.domainBreakdown).toHaveLength(1);
    expect(body.domainBreakdown[0].domain).toBe('Domain D1');
    expect(body.domainBreakdown[0].total).toBe(2);
    expect(body.domainBreakdown[0].correct).toBe(1);
    expect(body.domainBreakdown[0].percentage).toBe(50);
  });

  it('should return 403 for user without practice session access', async () => {
    setupMocks({ canAccess: false });

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe('PAYWALL');
  });

  it('should return 401 for unauthenticated user', async () => {
    setupMocks({ user: null });

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('should return 404 for non-existent session', async () => {
    setupMocks({
      sessionError: { code: 'PGRST116', message: 'No rows returned' },
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('Session not found');
  });

  it('should return 403 for session owned by different user', async () => {
    setupMocks({
      session: {
        id: 'session-123',
        user_id: 'other-user',
        completed_at: '2024-01-01T01:00:00Z',
        exam: 'pmle',
        created_at: '2024-01-01T00:00:00Z',
        question_count: 2,
      },
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe('Unauthorized to access this session');
  });

  it('should return 400 for incomplete session', async () => {
    setupMocks({
      session: {
        id: 'session-123',
        user_id: 'test-user',
        completed_at: null,
        exam: 'pmle',
        created_at: '2024-01-01T00:00:00Z',
        question_count: 2,
      },
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Session not completed yet');
  });

  it('should handle questions without responses', async () => {
    setupMocks({
      questions: [
        {
          id: 'q1',
          stem: 'Test question 1',
          options: [{ label: 'A', text: 'Option A' }],
          correct_label: 'A',
          canonical_question_id: 'canonical-q1',
          domain_code: 'D1',
          practice_responses: null,
        },
      ],
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.summary.questions[0].userAnswer).toBe('');
    expect(body.summary.questions[0].isCorrect).toBe(false);
  });

  it('should handle questions without domain codes', async () => {
    setupMocks({
      questions: [
        {
          id: 'q1',
          stem: 'Test question 1',
          options: [{ label: 'A', text: 'Option A' }],
          correct_label: 'A',
          canonical_question_id: 'canonical-q1',
          domain_code: null,
          practice_responses: [
            { selected_label: 'A', is_correct: true, responded_at: '2024-01-01T00:30:00Z' },
          ],
        },
      ],
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/summary/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/summary');
    const params = { sessionId: 'session-123' };

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.domainBreakdown).toHaveLength(0);
    expect(body.summary.questions[0].domain).toBeNull();
  });
});

