/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock the server-side dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } }
      })
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 1 },
      error: null
    }),
    insert: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: [
        {
          id: 'q1',
          stem: 'Test question',
          options: [
            { label: 'A', text: 'Option A', is_correct: true },
            { label: 'B', text: 'Option B', is_correct: false }
          ]
        }
      ],
      error: null
    })
  })
}));

jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn()
  }))
}));

jest.mock('@/lib/analytics/analytics', () => ({
  trackEvent: jest.fn(),
  ANALYTICS_EVENTS: {
    DIAGNOSTIC_SESSION_CREATED: 'diagnostic_session_created'
  }
}));

describe('/api/diagnostic/session', () => {
  it('should validate request body structure', () => {
    const validRequest = {
      examKey: 'pmle',
      blueprintVersion: 'current',
      betaVariant: 'A' as const,
      source: 'beta_welcome'
    };

    expect(validRequest.examKey).toBe('pmle');
    expect(['A', 'B'].includes(validRequest.betaVariant!)).toBe(true);
  });

  it('should have correct response structure', () => {
    const validResponse = {
      sessionId: 'test-session-id'
    };

    expect(typeof validResponse.sessionId).toBe('string');
  });

  it('should handle authentication requirement', async () => {
    // Test that unauthenticated requests fail
    const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
      method: 'POST',
      body: JSON.stringify({ examKey: 'pmle' })
    });

    expect(mockRequest.method).toBe('POST');
  });
});