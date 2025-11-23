/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock the server-side dependencies
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn()
}));

jest.mock('@/lib/auth/rate-limiter', () => ({
  checkRateLimit: jest.fn()
}));

jest.mock('@/lib/practice/domain-selection', () => ({
  selectPracticeQuestionsByDomains: jest.fn()
}));

jest.mock('@/lib/auth/require-subscriber', () => ({
  requireSubscriber: jest.fn().mockResolvedValue(null)
}));

describe('/api/practice/session', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should reject invalid JSON', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
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
            data: { user: { id: 'test-user' } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'invalid-key',
          domainCodes: ['D1']
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
      
      const responseBody = await response.json();
      expect(responseBody.error).toContain('Only \'pmle\' exam key is currently supported');
    });

    it('should reject empty domain codes array', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: []
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
      
      const responseBody = await response.json();
      expect(responseBody.error).toContain('At least one domain code must be provided');
    });

    it('should reject invalid question count (too low)', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1'],
          questionCount: 3
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
      
      const responseBody = await response.json();
      expect(responseBody.error).toContain('Must have at least 5 questions');
    });

    it('should reject invalid question count (too high)', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1'],
          questionCount: 25
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
      
      const responseBody = await response.json();
      expect(responseBody.error).toContain('Cannot exceed 20 questions');
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
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

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1']
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(401);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Authentication required');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(false);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1']
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(429);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Too many requests. Please try again later.');
    });
  });

  describe('Successful Session Creation', () => {
    it('should create practice session with valid request', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPracticeQuestionsByDomains } = require('@/lib/practice/domain-selection');
      selectPracticeQuestionsByDomains.mockResolvedValue({
        questions: [
          {
            id: 'q1',
            stem: 'Question 1',
            domain_id: 'domain-1',
            domain_code: 'D1',
            domain_name: 'Domain 1',
            answers: [
              { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
              { choice_label: 'B', choice_text: 'Answer B', is_correct: false },
            ]
          },
          {
            id: 'q2',
            stem: 'Question 2',
            domain_id: 'domain-2',
            domain_code: 'D2',
            domain_name: 'Domain 2',
            answers: [
              { choice_label: 'A', choice_text: 'Answer A', is_correct: false },
              { choice_label: 'B', choice_text: 'Answer B', is_correct: true },
            ]
          }
        ],
        domainDistribution: [
          { domainCode: 'D1', requestedCount: 1, availableCount: 10, selectedCount: 1 },
          { domainCode: 'D2', requestedCount: 1, availableCount: 10, selectedCount: 1 }
        ],
        totalRequested: 2,
        totalSelected: 2
      });

      const mockSessionInsert = jest.fn().mockResolvedValue({
        data: { id: 'session-123' },
        error: null
      });

      const mockQuestionsInsert = jest.fn().mockResolvedValue({
        error: null
      });

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        },
        from: jest.fn((table) => {
          if (table === 'practice_sessions') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: mockSessionInsert
                })
              })
            };
          }
          if (table === 'practice_questions') {
            return {
              insert: mockQuestionsInsert
            };
          }
          return {};
        })
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1', 'D2'],
          questionCount: 10
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.sessionId).toBe('session-123');
      expect(responseBody.route).toBe('/practice?sessionId=session-123');
      expect(responseBody.questionCount).toBe(2);
      expect(responseBody.domainDistribution).toBeDefined();
      expect(responseBody.domainDistribution.length).toBe(2);

      // Verify session was created with correct data
      expect(mockSupabase.from).toHaveBeenCalledWith('practice_sessions');
      expect(mockSupabase.from).toHaveBeenCalledWith('practice_questions');
      expect(mockQuestionsInsert).toHaveBeenCalled();
    });

    it('should use default question count of 10', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPracticeQuestionsByDomains } = require('@/lib/practice/domain-selection');
      selectPracticeQuestionsByDomains.mockResolvedValue({
        questions: [],
        domainDistribution: [],
        totalRequested: 10,
        totalSelected: 0
      });

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1']
        })
      });

      // Should call selector with default questionCount of 10
      await POST(mockRequest);
      expect(selectPracticeQuestionsByDomains).toHaveBeenCalledWith(
        expect.anything(),
        'pmle',
        ['D1'],
        10
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle empty question selection (no domains found)', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPracticeQuestionsByDomains } = require('@/lib/practice/domain-selection');
      // When no domains are found, the function returns empty results (doesn't throw)
      selectPracticeQuestionsByDomains.mockResolvedValue({
        questions: [],
        domainDistribution: [
          { domainCode: 'D1', requestedCount: 0, availableCount: 0, selectedCount: 0 }
        ],
        totalRequested: 10,
        totalSelected: 0
      });

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1']
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(404);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('No questions available for the requested domains.');
    });

    it('should handle unexpected question selection errors', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPracticeQuestionsByDomains } = require('@/lib/practice/domain-selection');
      selectPracticeQuestionsByDomains.mockRejectedValue(new Error('Database connection failed'));

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1']
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Could not fetch questions for the practice session.');
    });

    it('should handle empty question selection', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPracticeQuestionsByDomains } = require('@/lib/practice/domain-selection');
      selectPracticeQuestionsByDomains.mockResolvedValue({
        questions: [],
        domainDistribution: [],
        totalRequested: 10,
        totalSelected: 0
      });

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1']
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(404);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('No questions available for the requested domains.');
    });

    it('should handle session creation errors', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPracticeQuestionsByDomains } = require('@/lib/practice/domain-selection');
      selectPracticeQuestionsByDomains.mockResolvedValue({
        questions: [
          {
            id: 'q1',
            stem: 'Question 1',
            domain_id: 'domain-1',
            domain_code: 'D1',
            domain_name: 'Domain 1',
            answers: [
              { choice_label: 'A', choice_text: 'Answer A', is_correct: true }
            ]
          }
        ],
        domainDistribution: [],
        totalRequested: 1,
        totalSelected: 1
      });

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        },
        from: jest.fn((table) => {
          if (table === 'practice_sessions') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' }
                  })
                })
              })
            };
          }
          return {};
        })
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1']
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Failed to create practice session.');
    });

    it('should handle question snapshot creation errors and cleanup', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPracticeQuestionsByDomains } = require('@/lib/practice/domain-selection');
      selectPracticeQuestionsByDomains.mockResolvedValue({
        questions: [
          {
            id: 'q1',
            stem: 'Question 1',
            domain_id: 'domain-1',
            domain_code: 'D1',
            domain_name: 'Domain 1',
            answers: [
              { choice_label: 'A', choice_text: 'Answer A', is_correct: true }
            ]
          }
        ],
        domainDistribution: [],
        totalRequested: 1,
        totalSelected: 1
      });

      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({
        eq: mockEq
      });

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        },
        from: jest.fn((table) => {
          if (table === 'practice_sessions') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'session-123' },
                    error: null
                  })
                })
              }),
              delete: mockDelete
            };
          }
          if (table === 'practice_questions') {
            return {
              insert: jest.fn().mockResolvedValue({
                error: { message: 'Snapshot error' }
              })
            };
          }
          return {};
        })
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1']
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Failed to prepare practice questions.');

      // Verify cleanup was attempted
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'session-123');
    });
  });

  describe('Domain Distribution', () => {
    it('should return domain distribution in response', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const { selectPracticeQuestionsByDomains } = require('@/lib/practice/domain-selection');
      selectPracticeQuestionsByDomains.mockResolvedValue({
        questions: [
          {
            id: 'q1',
            stem: 'Question 1',
            domain_id: 'domain-1',
            domain_code: 'D1',
            domain_name: 'Domain 1',
            answers: [
              { choice_label: 'A', choice_text: 'Answer A', is_correct: true }
            ]
          },
          {
            id: 'q2',
            stem: 'Question 2',
            domain_id: 'domain-2',
            domain_code: 'D2',
            domain_name: 'Domain 2',
            answers: [
              { choice_label: 'B', choice_text: 'Answer B', is_correct: true }
            ]
          }
        ],
        domainDistribution: [
          { domainCode: 'D1', requestedCount: 5, availableCount: 10, selectedCount: 5 },
          { domainCode: 'D2', requestedCount: 5, availableCount: 8, selectedCount: 5 }
        ],
        totalRequested: 10,
        totalSelected: 10
      });

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
            error: null
          })
        },
        from: jest.fn((table) => {
          if (table === 'practice_sessions') {
            return {
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'session-123' },
                    error: null
                  })
                })
              })
            };
          }
          if (table === 'practice_questions') {
            return {
              insert: jest.fn().mockResolvedValue({ error: null })
            };
          }
          return {};
        })
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/practice/session/route');
      
      const mockRequest = new NextRequest('http://localhost/api/practice/session', {
        method: 'POST',
        body: JSON.stringify({ 
          examKey: 'pmle',
          domainCodes: ['D1', 'D2'],
          questionCount: 10
        })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.domainDistribution).toEqual([
        { domainCode: 'D1', selectedCount: 5, requestedCount: 5 },
        { domainCode: 'D2', selectedCount: 5, requestedCount: 5 }
      ]);
    });
  });
});

