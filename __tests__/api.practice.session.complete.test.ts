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
    updateError?: any;
  } = {}) => {
    const {
      user = { id: 'test-user' },
      session = {
        id: 'session-123',
        user_id: 'test-user',
        completed_at: null,
      },
      updateError = null,
    } = options;

    const updateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        error: updateError,
      }),
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
        return {};
      }),
    };

    const { createServerSupabaseClient } = require('@/lib/supabase/server');
    createServerSupabaseClient.mockReturnValue(mockSupabase);

    return { mockSupabase, updateMock };
  };

  it('should complete session successfully', async () => {
    const { updateMock } = setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sessionId).toBe('session-123');
    expect(body.route).toBe('/practice/session/session-123/summary');

    expect(updateMock).toHaveBeenCalledWith({
      completed_at: expect.any(String),
    });
  });

  it('should return success if session already completed', async () => {
    setupMocks({
      session: {
        id: 'session-123',
        user_id: 'test-user',
        completed_at: '2024-01-01T01:00:00Z',
      },
    });

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.route).toBe('/practice/session/session-123/summary');
  });

  it('should return 401 for unauthenticated user', async () => {
    setupMocks({ user: null });

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('should return 404 for non-existent session', async () => {
    setupMocks({
      session: null,
    });

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user' } },
          error: null,
        }),
      },
      from: jest.fn((table) => {
        if (table === 'practice_sessions') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          };
        }
        return {};
      }),
    };

    const { createServerSupabaseClient } = require('@/lib/supabase/server');
    createServerSupabaseClient.mockReturnValue(mockSupabase);

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('Session not found');
  });

  it('should return 403 for session owned by different user', async () => {
    setupMocks({
      session: {
        id: 'session-123',
        user_id: 'other-user',
        completed_at: null,
      },
    });

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe('Unauthorized to access this session');
  });

  it('should return 500 if update fails', async () => {
    setupMocks({
      updateError: { message: 'Database error' },
    });

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/session-123/complete', {
      method: 'POST',
    });
    const params = Promise.resolve({ sessionId: 'session-123' });

    const res = await POST(req, { params });
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe('Failed to complete session');
  });

  it('should return 400 for invalid session ID', async () => {
    setupMocks();

    const { POST } = require('@/app/api/practice/session/[sessionId]/complete/route');
    const req = new NextRequest('http://localhost/api/practice/session/invalid/complete', {
      method: 'POST',
    });
    const params = Promise.resolve({ sessionId: '' });

    const res = await POST(req, { params });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid session ID provided');
  });
});

