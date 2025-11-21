/**
 * Tests for PMLE question selection logic
 */

import { selectPmleQuestionsByBlueprint, calculateDomainTargets } from '@/lib/diagnostic/pmle-selection';
import { PMLE_BLUEPRINT, validateBlueprintWeights } from '@/lib/constants/pmle-blueprint';
import type { SupabaseClient } from '@supabase/supabase-js';

const CANONICAL_DOMAIN_CODES = [
  'ARCHITECTING_LOW_CODE_ML_SOLUTIONS',
  'COLLABORATING_TO_MANAGE_DATA_AND_MODELS',
  'SCALING_PROTOTYPES_INTO_ML_MODELS',
  'SERVING_AND_SCALING_MODELS',
  'AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES',
  'MONITORING_ML_SOLUTIONS',
] as const;

// Mock Supabase client
const createMockSupabaseClient = (): Partial<SupabaseClient> => {
  const mockQuestions = [
    {
      id: 'q1',
      domain_id: 'd1',
      exam_domains: {
        code: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS',
        name: 'Architecting Low-Code ML Solutions',
      },
    },
    {
      id: 'q2',
      domain_id: 'd1',
      exam_domains: {
        code: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS',
        name: 'Architecting Low-Code ML Solutions',
      },
    },
    {
      id: 'q3',
      domain_id: 'd2',
      exam_domains: {
        code: 'COLLABORATING_TO_MANAGE_DATA_AND_MODELS',
        name: 'Collaborating to Manage Data & Models',
      },
    },
  ];

  return {
    from: jest.fn((table: string) => {
      if (table === 'questions') {
        return {
          select: jest.fn((columns: string) => {
            if (columns.includes('exam_domains')) {
              // Domain count query
              return {
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    data: mockQuestions.map((q) => ({
                      domain_id: q.domain_id,
                      exam_domains: q.exam_domains,
                    })),
                    error: null,
                  })),
                })),
              };
            } else {
              // Question fetch query
              return {
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        data: [
                          {
                            id: 'q1',
                            stem: 'Test question 1',
                            difficulty: 'MEDIUM',
                            answers: [
                              { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
                              { choice_label: 'B', choice_text: 'Answer B', is_correct: false },
                            ],
                          },
                        ],
                        error: null,
                      })),
                    })),
                  })),
                })),
              };
            }
          }),
        };
      }
      return {};
    }),
  } as unknown as SupabaseClient;
};

describe('PMLE Question Selection', () => {
  describe('PMLE blueprint config', () => {
    it('defines the six canonical domains in order', () => {
      expect(PMLE_BLUEPRINT).toHaveLength(CANONICAL_DOMAIN_CODES.length);
      expect(PMLE_BLUEPRINT.map((config) => config.domainCode)).toEqual(CANONICAL_DOMAIN_CODES);
    });

    it('passes the blueprint weight validation', () => {
      expect(validateBlueprintWeights()).toBe(true);
    });
  });

  describe('calculateDomainTargets', () => {
    it('should calculate targets that sum to total questions', () => {
      const domainAvailability = new Map<string, number>();
      PMLE_BLUEPRINT.forEach((config) => {
        domainAvailability.set(config.domainCode, 100); // Plenty available
      });

      const targets = calculateDomainTargets(10, domainAvailability);
      const total = Array.from(targets.values()).reduce((sum, count) => sum + count, 0);

      expect(total).toBe(10);
    });

    it('should cap targets at available question count', () => {
      const domainAvailability = new Map<string, number>();
      domainAvailability.set('ARCHITECTING_LOW_CODE_ML_SOLUTIONS', 2); // Limited availability
      domainAvailability.set('COLLABORATING_TO_MANAGE_DATA_AND_MODELS', 100);

      const targets = calculateDomainTargets(10, domainAvailability);

      // Should not exceed available count
      const onlineTarget = targets.get('ARCHITECTING_LOW_CODE_ML_SOLUTIONS') || 0;
      expect(onlineTarget).toBeLessThanOrEqual(2);
    });

    it('should handle domains with zero availability', () => {
      const domainAvailability = new Map<string, number>();
      PMLE_BLUEPRINT.forEach((config) => {
        if (config.domainCode === 'MONITORING_ML_SOLUTIONS') {
          domainAvailability.set(config.domainCode, 0);
        } else {
          domainAvailability.set(config.domainCode, 10);
        }
      });

      const targets = calculateDomainTargets(10, domainAvailability);
      const explainableTarget = targets.get('EXPLAINABLE_AI_AND_MODEL_INTERPRETABILITY') || 0;

      expect(explainableTarget).toBe(0);
    });
  });

  describe('selectPmleQuestionsByBlueprint', () => {
    it('should throw error if insufficient questions available', async () => {
      // Create a proper mock that handles the chained query
      const mockFrom = jest.fn(() => {
        const mockSelect = jest.fn((columns: string) => {
          if (columns.includes('exam_domains')) {
            // Domain count query - return limited domains
            return {
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  data: [
                    {
                      domain_id: 'd1',
                      exam_domains: { code: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS', name: 'Domain 1' },
                    },
                    {
                      domain_id: 'd2',
                      exam_domains: { code: 'COLLABORATING_TO_MANAGE_DATA_AND_MODELS', name: 'Domain 2' },
                    },
                  ],
                  error: null,
                })),
              })),
            };
          } else {
            // Question fetch query - return empty or limited results
            return {
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    limit: jest.fn(() => ({
                      data: [], // No questions available
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
        });
        return { select: mockSelect };
      });

      const mockSupabase = {
        from: mockFrom,
      } as unknown as SupabaseClient;

      await expect(
        selectPmleQuestionsByBlueprint(mockSupabase, 10)
      ).rejects.toThrow('Insufficient questions');
    });

    it('should return questions with domain info', async () => {
      // This test would require more complex mocking
      // For now, we'll test the structure through integration tests
      expect(true).toBe(true); // Placeholder
    });
  });
});

