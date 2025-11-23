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

jest.mock('@/lib/access/pmleEntitlements.server', () => ({
  getPmleAccessLevelForRequest: jest.fn()
}));

jest.mock('@/lib/access/pmleEntitlements', () => ({
  canUseFeature: jest.fn(),
  // Mock other exports if needed, but canUseFeature is the one used
}));

// Mock the quota module
jest.mock('@/lib/practice/quota', () => ({
  checkAndIncrementQuota: jest.fn()
}));

describe('/api/practice/session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupMocks = (options: { 
    accessLevel?: string, 
    user?: any, 
    allowedFeatures?: string[],
    quotaAllowed?: boolean,
    questions?: any[]
  } = {}) => {
    const { 
      accessLevel = 'SUBSCRIBER', 
      user = { id: 'test-user' }, 
      allowedFeatures = ['PRACTICE_SESSION'],
      quotaAllowed = true,
      questions = [{ id: 'q1', stem: 'Q1', answers: [{ choice_label: 'A', choice_text: 'A', is_correct: true }], domain_code: 'D1' }]
    } = options;

    const { checkRateLimit } = require('@/lib/auth/rate-limiter');
    checkRateLimit.mockResolvedValue(true);

    const { getPmleAccessLevelForRequest } = require('@/lib/access/pmleEntitlements.server');
    getPmleAccessLevelForRequest.mockResolvedValue({ accessLevel, user });

    const { canUseFeature } = require('@/lib/access/pmleEntitlements');
    canUseFeature.mockImplementation((_level: string, feature: string) => {
      return allowedFeatures.includes(feature);
    });

    const { checkAndIncrementQuota } = require('@/lib/practice/quota');
    checkAndIncrementQuota.mockResolvedValue({ allowed: quotaAllowed });

    const { selectPracticeQuestionsByDomains } = require('@/lib/practice/domain-selection');
    selectPracticeQuestionsByDomains.mockResolvedValue({
      questions,
      domainDistribution: [{ domainCode: 'D1', requestedCount: 1, availableCount: 10, selectedCount: 1 }],
      totalRequested: 1,
      totalSelected: 1
    });

    const mockSupabase = {
      from: jest.fn((table) => ({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'session-123' }, error: null })
          })
        }),
        delete: jest.fn()
      })),
      rpc: jest.fn()
    };
    const { createServerSupabaseClient } = require('@/lib/supabase/server');
    createServerSupabaseClient.mockReturnValue(mockSupabase);

    return { mockSupabase };
  };

  it('should allow subscriber to create session without quota check', async () => {
    setupMocks({ accessLevel: 'SUBSCRIBER', allowedFeatures: ['PRACTICE_SESSION'] });
    
    const { POST } = require('@/app/api/practice/session/route');
    const req = new NextRequest('http://localhost/api/practice/session', {
      method: 'POST',
      body: JSON.stringify({ examKey: 'pmle', domainCodes: ['D1'] })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const { checkAndIncrementQuota } = require('@/lib/practice/quota');
    expect(checkAndIncrementQuota).not.toHaveBeenCalled();
  });

  it('should check quota for free user', async () => {
    setupMocks({ 
      accessLevel: 'FREE', 
      allowedFeatures: ['PRACTICE_SESSION_FREE_QUOTA'], 
      quotaAllowed: true 
    });
    
    const { POST } = require('@/app/api/practice/session/route');
    const req = new NextRequest('http://localhost/api/practice/session', {
      method: 'POST',
      body: JSON.stringify({ examKey: 'pmle', domainCodes: ['D1'], questionCount: 5 })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const { checkAndIncrementQuota } = require('@/lib/practice/quota');
    expect(checkAndIncrementQuota).toHaveBeenCalledWith(expect.anything(), 'test-user', 'pmle', 5);
  });

  it('should block free user if quota exceeded', async () => {
    setupMocks({ 
      accessLevel: 'FREE', 
      allowedFeatures: ['PRACTICE_SESSION_FREE_QUOTA'], 
      quotaAllowed: false 
    });
    
    const { checkAndIncrementQuota } = require('@/lib/practice/quota');
    checkAndIncrementQuota.mockResolvedValue({ 
        allowed: false, 
        usage: { sessions_started: 1, questions_served: 5, week_start: '2023-01-01' } 
    });

    const { POST } = require('@/app/api/practice/session/route');
    const req = new NextRequest('http://localhost/api/practice/session', {
      method: 'POST',
      body: JSON.stringify({ examKey: 'pmle', domainCodes: ['D1'], questionCount: 5 })
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('FREE_QUOTA_EXCEEDED');
  });

  it('should block anonymous user', async () => {
    setupMocks({ user: null });
    
    const { POST } = require('@/app/api/practice/session/route');
    const req = new NextRequest('http://localhost/api/practice/session', {
      method: 'POST',
      body: JSON.stringify({ examKey: 'pmle', domainCodes: ['D1'] })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should block user without any entitlements', async () => {
    setupMocks({ accessLevel: 'BANNED', allowedFeatures: [] });
    
    const { POST } = require('@/app/api/practice/session/route');
    const req = new NextRequest('http://localhost/api/practice/session', {
      method: 'POST',
      body: JSON.stringify({ examKey: 'pmle', domainCodes: ['D1'] })
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('PAYWALL');
  });
});
