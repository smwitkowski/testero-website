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

describe('/api/beta/variant', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST - Variant Assignment', () => {
    it('should assign variant A for user ID that hashes to even', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'test-user-even-hash', // This should hash to even (variant A)
                user_metadata: {} 
              } 
            },
            error: null
          }),
          updateUser: jest.fn().mockResolvedValue({ error: null })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/beta/variant/route');
      
      const mockRequest = new NextRequest('http://localhost/api/beta/variant', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.variant).toMatch(/^[AB]$/);
      expect(responseBody.assigned).toBe(true);
      expect(mockSupabase.auth.updateUser).toHaveBeenCalled();
    });

    it('should return existing variant if already assigned', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'test-user-id', 
                user_metadata: { beta_variant: 'B' } 
              } 
            },
            error: null
          }),
          updateUser: jest.fn()
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/beta/variant/route');
      
      const mockRequest = new NextRequest('http://localhost/api/beta/variant', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.variant).toBe('B');
      expect(responseBody.assigned).toBe(false);
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should allow forced variant in development', async () => {
      // Mock NODE_ENV to development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'test-user-id', 
                user_metadata: { beta_variant: 'A' } 
              } 
            },
            error: null
          }),
          updateUser: jest.fn()
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/beta/variant/route');
      
      const mockRequest = new NextRequest('http://localhost/api/beta/variant', {
        method: 'POST',
        body: JSON.stringify({ forceVariant: 'B' })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.variant).toBe('B');
      expect(responseBody.assigned).toBe(false);

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should reject unauthenticated requests', async () => {
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

      const { POST } = require('@/app/api/beta/variant/route');
      
      const mockRequest = new NextRequest('http://localhost/api/beta/variant', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(401);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Authentication required');
    });

    it('should reject rate limited requests', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(false);

      const { POST } = require('@/app/api/beta/variant/route');
      
      const mockRequest = new NextRequest('http://localhost/api/beta/variant', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(429);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Too many requests. Please try again later.');
    });

    it('should handle invalid force variant', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'test-user-id', 
                user_metadata: {} 
              } 
            },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/beta/variant/route');
      
      const mockRequest = new NextRequest('http://localhost/api/beta/variant', {
        method: 'POST',
        body: JSON.stringify({ forceVariant: 'C' })
      });

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
      
      const responseBody = await response.json();
      expect(responseBody.error).toContain('Invalid request data');
    });
  });

  describe('GET - Variant Retrieval', () => {
    it('should return existing variant', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'test-user-id', 
                user_metadata: { beta_variant: 'A' } 
              } 
            },
            error: null
          })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { GET } = require('@/app/api/beta/variant/route');
      
      const mockRequest = new NextRequest('http://localhost/api/beta/variant', {
        method: 'GET'
      });

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.variant).toBe('A');
      expect(responseBody.assigned).toBe(false);
    });

    it('should assign variant if none exists', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: 'test-user-id', 
                user_metadata: {} 
              } 
            },
            error: null
          }),
          updateUser: jest.fn().mockResolvedValue({ error: null })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { GET } = require('@/app/api/beta/variant/route');
      
      const mockRequest = new NextRequest('http://localhost/api/beta/variant', {
        method: 'GET'
      });

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.variant).toMatch(/^[AB]$/);
      expect(responseBody.assigned).toBe(true);
    });
  });

  describe('Variant Assignment Logic', () => {
    it('should consistently assign same variant for same user ID', async () => {
      const { checkRateLimit } = require('@/lib/auth/rate-limiter');
      checkRateLimit.mockResolvedValue(true);

      const testUserId = 'consistent-test-user-id';

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: testUserId, 
                user_metadata: {} 
              } 
            },
            error: null
          }),
          updateUser: jest.fn().mockResolvedValue({ error: null })
        }
      };

      const { createServerSupabaseClient } = require('@/lib/supabase/server');
      createServerSupabaseClient.mockReturnValue(mockSupabase);

      const { POST } = require('@/app/api/beta/variant/route');
      
      // Make multiple requests with the same user ID
      const results = [];
      for (let i = 0; i < 5; i++) {
        const mockRequest = new NextRequest('http://localhost/api/beta/variant', {
          method: 'POST',
          body: JSON.stringify({})
        });

        const response = await POST(mockRequest);
        const responseBody = await response.json();
        results.push(responseBody.variant);
      }

      // All results should be the same
      const firstVariant = results[0];
      results.forEach(variant => {
        expect(variant).toBe(firstVariant);
      });
    });
  });
});