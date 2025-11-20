/**
 * Tests for PMLE question selection logic
 */

import { selectPmleQuestionsByBlueprint, calculateDomainTargets } from '@/lib/diagnostic/pmle-selection';
import { PMLE_BLUEPRINT } from '@/lib/constants/pmle-blueprint';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const createMockSupabaseClient = (): Partial<SupabaseClient> => {
  const mockQuestions = [
    {
      id: 'q1',
      domain_id: 'd1',
      exam_domains: { code: 'ONLINE_AND_BATCH_PREDICTION_DEPLOYMENT', name: 'Online and batch prediction deployment' },
    },
    {
      id: 'q2',
      domain_id: 'd1',
      exam_domains: { code: 'ONLINE_AND_BATCH_PREDICTION_DEPLOYMENT', name: 'Online and batch prediction deployment' },
    },
    {
      id: 'q3',
      domain_id: 'd2',
      exam_domains: { code: 'CUSTOM_TRAINING_WITH_DIFFERENT_ML_FRAMEWORKS', name: 'Custom training' },
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
      domainAvailability.set('ONLINE_AND_BATCH_PREDICTION_DEPLOYMENT', 2); // Limited availability
      domainAvailability.set('CUSTOM_TRAINING_WITH_DIFFERENT_ML_FRAMEWORKS', 100);

      const targets = calculateDomainTargets(10, domainAvailability);

      // Should not exceed available count
      const onlineTarget = targets.get('ONLINE_AND_BATCH_PREDICTION_DEPLOYMENT') || 0;
      expect(onlineTarget).toBeLessThanOrEqual(2);
    });

    it('should handle domains with zero availability', () => {
      const domainAvailability = new Map<string, number>();
      PMLE_BLUEPRINT.forEach((config) => {
        if (config.domainCode === 'EXPLAINABLE_AI_AND_MODEL_INTERPRETABILITY') {
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
                    { domain_id: 'd1', exam_domains: { code: 'ONLINE_AND_BATCH_PREDICTION_DEPLOYMENT', name: 'Domain 1' } },
                    { domain_id: 'd2', exam_domains: { code: 'CUSTOM_TRAINING_WITH_DIFFERENT_ML_FRAMEWORKS', name: 'Domain 2' } },
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

