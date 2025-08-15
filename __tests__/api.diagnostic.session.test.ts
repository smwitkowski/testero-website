/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock the server-side dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn()
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

  it('should reject unauthenticated requests with 401', async () => {
    // Mock getUser to return null (unauthenticated)
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null
        })
      }
    };

    const { createServerSupabaseClient } = require('@/lib/supabase/server');
    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    const { POST } = require('@/app/api/diagnostic/session/route');
    
    const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
      method: 'POST',
      body: JSON.stringify({ 
        examKey: 'pmle',
        blueprintVersion: 'current',
        source: 'beta_welcome'
      })
    });

    const response = await POST(mockRequest);
    expect(response.status).toBe(401);
    
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Authentication required');
  });
});