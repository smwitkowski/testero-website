/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock the server-side dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn()
}));

describe('POST /api/practice/session/[sessionId]/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupMocks = (options: {
    user?: any;
    session?: any;
    answers?: Record<string, string>;
  } = {}) => {
    const {
      user = { id: 'test-user' },
      session = {
        id: 'session-123',
        user_id: 'test-user',
        completed_at: null,
      },
      answers = {
        'q1': 'A',
        'q2': 'B',
      },
    } = options;

    const insertMock = jest.fn().mockResolvedValue({
      data: [{ id: 'resp-1' }],
      error: null,
    });

    const updateEqMock = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const updateMock = jest.fn().mockReturnValue({
      eq: updateEqMock,
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
              error: null,
            }),
            update: updateMock,
          };
        }
        if (table === 'practice_questions') {
          const eqMock = jest.fn().mockResolvedValue({
            data: [
              { id: 'q1', correct_label: 'A' },
              { id: 'q2', correct_label: 'B' },
              { id: 'q3', correct_label: 'C' },
            ],
            error: null,
          });
          return {
            select: jest.fn().mockReturnValue({
              eq: eqMock,
            }),
          };
        }
        if (table === 'practice_responses') {
          return {
            insert: insertMock,
          };
        }
        return {};
      }),
    };

    const { createServerSupabaseClient } = require('@/lib/supabase/server');
    createServerSupabaseClient.mockReturnValue(mockSupabase);

    return { mockSupabase, insertMock, updateMock };
  };

  it('accepts bulk answers payload', async () => {
    const { mockSupabase, insertMock } = setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
      body: JSON.stringify({
        answers: {
          'q1': 'A',
          'q2': 'B',
        },
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    const body = await res.json();
    if (res.status !== 200) {
      console.error('Response error:', body);
    }
    expect(res.status).toBe(200);

    // Verify responses were inserted
    expect(insertMock).toHaveBeenCalled();
    const insertedData = insertMock.mock.calls[0][0];
    expect(insertedData).toHaveLength(2);
    expect(insertedData[0]).toMatchObject({
      session_id: 'session-123',
      question_id: 'q1',
      selected_label: 'A',
    });
  });

  it('creates practice_responses for each answer', async () => {
    const { mockSupabase, insertMock } = setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
      body: JSON.stringify({
        answers: {
          'q1': 'A',
          'q2': 'B',
          'q3': 'C',
        },
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    expect(insertMock).toHaveBeenCalled();
    const insertedData = insertMock.mock.calls[0][0];
    expect(insertedData).toHaveLength(3);
  });

  it('marks session as completed', async () => {
    const { updateMock } = setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
      body: JSON.stringify({
        answers: {
          'q1': 'A',
        },
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    // Verify session was updated
    expect(updateMock).toHaveBeenCalled();
    const updateData = updateMock.mock.calls[0][0];
    expect(updateData).toHaveProperty('completed_at');
  });

  it('handles empty answers gracefully', async () => {
    const { updateMock } = setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
      body: JSON.stringify({
        answers: {},
      }),
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    // Should still mark session as completed even with no answers
    expect(updateMock).toHaveBeenCalled();
  });
});
