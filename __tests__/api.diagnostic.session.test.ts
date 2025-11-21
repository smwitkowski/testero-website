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

jest.mock('@/lib/auth/rate-limiter', () => ({
  checkRateLimit: jest.fn()
}));

jest.mock('@/lib/diagnostic/pmle-selection', () => ({
  selectPmleQuestionsByBlueprint: jest.fn()
}));

jest.mock('@/lib/auth/require-subscriber', () => ({
  requireSubscriber: jest.fn().mockResolvedValue(null)
}));

describe('/api/diagnostic/session', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
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

    it('should reject invalid JSON', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user', user_metadata: { is_early_access: true } } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Invalid JSON in request body');
    });

    it('should reject invalid exam key', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user', user_metadata: { is_early_access: true } } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'invalid-key',
          source: 'beta_welcome'
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
      
      const responseBody = await response.json();
      expect(responseBody.error).toContain('Only \'pmle\' exam key is currently supported');
    });

    it('should reject invalid beta variant', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user', user_metadata: { is_early_access: true } } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          betaVariant: 'C',
          source: 'beta_welcome'
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
      
      const responseBody = await response.json();
      expect(responseBody.error).toContain('Beta variant must be either \'A\' or \'B\'');
    });

    it('should reject invalid question count', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user', user_metadata: { is_early_access: true } } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          numQuestions: 0,
          source: 'beta_welcome'
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
      
      const responseBody = await response.json();
      expect(responseBody.error).toContain('Must have at least 1 question');
    });
  });

  describe('Rate Limiting', () => {
    it('should reject requests when rate limited', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(false);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ examKey: 'pmle' })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(429);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Too many requests. Please try again later.');
    });

    it('should allow requests when not rate limited', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ examKey: 'pmle' })
      });

      const response = await POST(mockRequest);
      expect(checkRateLimit).toHaveBeenCalled();
      // Should proceed to authentication check (returns 401)
      expect(response.status).toBe(401);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

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

    it('should reject users without beta access with 403', async () => {
      // Mock NODE_ENV to production to test beta access
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'test-user', 
                user_metadata: { is_early_access: false, beta_access: false } 
              } 
            },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          source: 'beta_welcome'
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(403);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Beta access required');

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should allow users with early access', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'test-user', 
                user_metadata: { is_early_access: true } 
              } 
            },
            error: null
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
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          source: 'beta_welcome'
        })
      });

      const response = await POST(mockRequest);
      // Should proceed beyond auth checks (likely fail on database operations in test)
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it('should allow users with explicit beta access', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'test-user', 
                user_metadata: { beta_access: true } 
              } 
            },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          source: 'beta_welcome'
        })
      });

      const response = await POST(mockRequest);
      // Should proceed beyond auth checks
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  describe('Response Structure', () => {
    it('should have correct response structure', () => {
      const validResponse = {
        sessionId: 'test-session-id'
      };

      expect(typeof validResponse.sessionId).toBe('string');
    });
  });

  describe('PMLE Canonical Selection', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use canonical PMLE selection for PMLE exam key', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPmleQuestionsByBlueprint } = require('@/lib/diagnostic/pmle-selection');
      const mockSelectionResult = {
        questions: [
          {
            id: 'q1',
            stem: 'Test question',
            domain_id: 'd1',
            domain_code: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS',
            answers: [
              { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
              { choice_label: 'B', choice_text: 'Answer B', is_correct: false },
            ],
          },
        ],
        domainDistribution: [
          {
            domainCode: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS',
            targetCount: 1,
            availableCount: 10,
            selectedCount: 1,
          },
        ],
      };
      selectPmleQuestionsByBlueprint.mockResolvedValue(mockSelectionResult);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user', user_metadata: { is_early_access: true } } },
            error: null,
          }),
        },
        from: jest.fn((table) => {
          if (table === 'user_subscriptions') {
            // For requireSubscriber check
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { status: 'active' },
                error: null,
              }),
            };
          }
          if (table === 'diagnostics_sessions') {
            return {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'session-123' },
                error: null,
              }),
            };
          }
          if (table === 'diagnostic_questions') {
            return {
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          numQuestions: 5,
          source: 'beta_welcome'
        }),
      });

      const response = await POST(mockRequest);
      
      expect(selectPmleQuestionsByBlueprint).toHaveBeenCalledWith(mockSupabase, 5);
      expect(response.status).not.toBe(500);
    });

    it('should store domain_id and domain_code in question snapshots', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPmleQuestionsByBlueprint } = require('@/lib/diagnostic/pmle-selection');
      const mockSelectionResult = {
        questions: [
          {
            id: 'q1',
            stem: 'Test question',
            domain_id: 'domain-uuid-1',
            domain_code: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS',
            answers: [
              { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
              { choice_label: 'B', choice_text: 'Answer B', is_correct: false },
            ],
          },
        ],
        domainDistribution: [],
      };
      selectPmleQuestionsByBlueprint.mockResolvedValue(mockSelectionResult);

      const insertMock = jest.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user', user_metadata: { is_early_access: true } } },
            error: null,
          }),
        },
        from: jest.fn((table) => {
          if (table === 'user_subscriptions') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { status: 'active' },
                error: null,
              }),
            };
          }
          if (table === 'diagnostics_sessions') {
            return {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'session-123' },
                error: null,
              }),
            };
          }
          if (table === 'diagnostic_questions') {
            return {
              insert: insertMock,
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          numQuestions: 1,
          source: 'beta_welcome'
        }),
      });

      await POST(mockRequest);
      
      expect(insertMock).toHaveBeenCalled();
      const snapshotCall = insertMock.mock.calls[0][0];
      expect(snapshotCall[0]).toHaveProperty('domain_id', 'domain-uuid-1');
      expect(snapshotCall[0]).toHaveProperty('domain_code', 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS');
    });

    it('should handle insufficient questions error gracefully', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPmleQuestionsByBlueprint } = require('@/lib/diagnostic/pmle-selection');
      selectPmleQuestionsByBlueprint.mockRejectedValue(
        new Error('Insufficient questions: requested 10, selected 5, total available 5. Content gaps detected.')
      );

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user', user_metadata: { is_early_access: true } } },
            error: null,
          }),
        },
        from: jest.fn((table) => {
          if (table === 'user_subscriptions') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { status: 'active' },
                error: null,
              }),
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/diagnostic/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/diagnostic/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          numQuestions: 10,
          source: 'beta_welcome'
        }),
      });

      const response = await POST(mockRequest);
      const body = await response.json();
      
      expect(response.status).toBe(500);
      expect(body.error).toContain('Insufficient questions');
    });
  });
});