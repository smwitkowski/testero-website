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
  } = {}) => {
    const {
      user = { id: 'test-user' },
      session = {
        id: 'session-123',
        user_id: 'test-user',
        exam: 'pmle',
        created_at: '2024-01-01T00:00:00Z',
        question_count: 2,
        source: 'study_plan_domain',
        source_session_id: null,
        completed_at: null,
      },
      questions = [
        {
          id: 'q1',
          stem: 'Question 1',
          options: [{ label: 'A', text: 'Answer A' }],
          correct_label: 'A',
          domain_code: 'ML_OPS_DEPLOYMENT',
        },
        {
          id: 'q2',
          stem: 'Question 2',
          options: [{ label: 'B', text: 'Answer B' }],
          correct_label: 'B',
          domain_code: 'MONITORING_ML_SOLUTIONS',
        },
      ],
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
            order: jest.fn().mockResolvedValue({
              data: questions,
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

  it('includes domain_code in question response', async () => {
    setupMocks();

    const { GET } = require('@/app/api/practice/session/[sessionId]/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123');
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.session).toBeDefined();
    expect(data.session.questions).toHaveLength(2);
    expect(data.session.questions[0].domain_code).toBe('ML_OPS_DEPLOYMENT');
    expect(data.session.questions[1].domain_code).toBe('MONITORING_ML_SOLUTIONS');
  });

  it('handles questions without domain_code gracefully', async () => {
    setupMocks({
      questions: [
        {
          id: 'q1',
          stem: 'Question 1',
          options: [{ label: 'A', text: 'Answer A' }],
          correct_label: 'A',
          domain_code: null,
        },
      ],
    });

    const { GET } = require('@/app/api/practice/session/[sessionId]/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123');
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await GET(req, { params });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.session.questions[0].domain_code).toBeNull();
  });
});

