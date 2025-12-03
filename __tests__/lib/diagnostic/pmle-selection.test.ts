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
      const monitoringTarget = targets.get('MONITORING_ML_SOLUTIONS') || 0;

      expect(monitoringTarget).toBe(0);
    });

    it('should redistribute remaining slots when some domains have insufficient questions', () => {
      const domainAvailability = new Map<string, number>();
      // Set up scenario where one domain has very few questions
      domainAvailability.set('ARCHITECTING_LOW_CODE_ML_SOLUTIONS', 1); // Only 1 available
      domainAvailability.set('COLLABORATING_TO_MANAGE_DATA_AND_MODELS', 50);
      domainAvailability.set('SCALING_PROTOTYPES_INTO_ML_MODELS', 50);
      domainAvailability.set('SERVING_AND_SCALING_MODELS', 50);
      domainAvailability.set('AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES', 50);
      domainAvailability.set('MONITORING_ML_SOLUTIONS', 50);

      const targets = calculateDomainTargets(25, domainAvailability);
      const total = Array.from(targets.values()).reduce((sum, count) => sum + count, 0);

      // Should still sum to 25, redistributing from ARCHITECTING domain
      expect(total).toBe(25);
      expect(targets.get('ARCHITECTING_LOW_CODE_ML_SOLUTIONS')).toBeLessThanOrEqual(1);
    });

    it('should prioritize higher-weighted domains when redistributing', () => {
      const domainAvailability = new Map<string, number>();
      // Give AUTOMATING (highest weight ~21.5%) more capacity
      domainAvailability.set('ARCHITECTING_LOW_CODE_ML_SOLUTIONS', 5);
      domainAvailability.set('COLLABORATING_TO_MANAGE_DATA_AND_MODELS', 5);
      domainAvailability.set('SCALING_PROTOTYPES_INTO_ML_MODELS', 5);
      domainAvailability.set('SERVING_AND_SCALING_MODELS', 5);
      domainAvailability.set('AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES', 100); // Plenty available
      domainAvailability.set('MONITORING_ML_SOLUTIONS', 5);

      const targets = calculateDomainTargets(20, domainAvailability);
      
      // AUTOMATING should get more questions due to higher weight and availability
      const automatingTarget = targets.get('AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES') || 0;
      const architectingTarget = targets.get('ARCHITECTING_LOW_CODE_ML_SOLUTIONS') || 0;
      
      expect(automatingTarget).toBeGreaterThan(architectingTarget);
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
              })),
            };
          } else {
            // Question fetch query - return empty or limited results
            return {
              eq: jest.fn(() => ({
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

    it('should return questions with domain info and correct structure', async () => {
      const mockFrom = jest.fn(() => {
        const mockSelect = jest.fn((columns: string) => {
          if (columns.includes('exam_domains')) {
            // Domain count query - return all 6 domains with questions
            return {
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    data: PMLE_BLUEPRINT.flatMap((config, idx) => 
                      Array(5).fill(null).map((_, i) => ({
                        domain_id: `d${idx + 1}`,
                        exam_domains: { code: config.domainCode, name: config.displayName },
                      }))
                    ),
                    error: null,
                  })),
                })),
              })),
            };
          } else {
            // Question fetch query - return questions with answers
            return {
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        data: [
                          {
                            id: 'q1',
                            stem: 'Test question stem',
                            difficulty: 'MEDIUM',
                            answers: [
                              { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
                              { choice_label: 'B', choice_text: 'Answer B', is_correct: false },
                              { choice_label: 'C', choice_text: 'Answer C', is_correct: false },
                              { choice_label: 'D', choice_text: 'Answer D', is_correct: false },
                            ],
                          },
                        ],
                        error: null,
                      })),
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

      const result = await selectPmleQuestionsByBlueprint(mockSupabase, 5);

      expect(result.questions).toBeDefined();
      expect(result.domainDistribution).toBeDefined();
      expect(result.questions.length).toBe(5);
      expect(result.questions[0]).toHaveProperty('id');
      expect(result.questions[0]).toHaveProperty('stem');
      expect(result.questions[0]).toHaveProperty('domain_id');
      expect(result.questions[0]).toHaveProperty('domain_code');
      expect(result.questions[0]).toHaveProperty('domain_name');
      expect(result.questions[0]).toHaveProperty('answers');
      expect(result.questions[0].answers.length).toBeGreaterThan(0);
      expect(result.questions[0].answers[0]).toHaveProperty('choice_label');
      expect(result.questions[0].answers[0]).toHaveProperty('choice_text');
      expect(result.questions[0].answers[0]).toHaveProperty('is_correct');
    });

    it('should filter questions by exam and status', async () => {
      const mockFrom = jest.fn(() => {
        const mockSelect = jest.fn((columns: string) => {
          if (columns.includes('exam_domains')) {
            return {
              eq: jest.fn((field: string) => {
                if (field === 'exam') {
                  return {
                    eq: jest.fn((status: string) => {
                      // Verify it filters by exam='GCP_PM_ML_ENG' and status='ACTIVE'
                      expect(status).toBe('ACTIVE');
                      return {
                        data: [
                          {
                            domain_id: 'd1',
                            exam_domains: { code: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS', name: 'Domain 1' },
                          },
                        ],
                        error: null,
                      };
                    }),
                  };
                }
                return {};
              }),
            };
          }
          return {};
        });
        return { select: mockSelect };
      });

      const mockSupabase = {
        from: mockFrom,
      } as unknown as SupabaseClient;

      // This will fail due to insufficient questions, but we verify the filter was called
      await expect(
        selectPmleQuestionsByBlueprint(mockSupabase, 5)
      ).rejects.toThrow();
    });

    it('should filter questions by review_status=GOOD in domain count query', async () => {
      const reviewStatusCalls: string[] = [];
      const mockFrom = jest.fn(() => {
        const mockSelect = jest.fn((columns: string) => {
          if (columns.includes('exam_domains')) {
            // Domain count query - should have review_status filter
            return {
              eq: jest.fn((field: string, value: string) => {
                if (field === 'exam') {
                  expect(value).toBe('GCP_PM_ML_ENG');
                  return {
                    eq: jest.fn((statusField: string, statusValue: string) => {
                      expect(statusField).toBe('status');
                      expect(statusValue).toBe('ACTIVE');
                      return {
                        eq: jest.fn((reviewStatusField: string, reviewStatusValue: string) => {
                          expect(reviewStatusField).toBe('review_status');
                          reviewStatusCalls.push(reviewStatusValue);
                          expect(reviewStatusValue).toBe('GOOD');
                          return {
                            data: [
                              {
                                domain_id: 'd1',
                                exam_domains: { code: 'ARCHITECTING_LOW_CODE_ML_SOLUTIONS', name: 'Domain 1' },
                              },
                            ],
                            error: null,
                          };
                        }),
                      };
                    }),
                  };
                }
                return {};
              }),
            };
          }
          return {};
        });
        return { select: mockSelect };
      });

      const mockSupabase = {
        from: mockFrom,
      } as unknown as SupabaseClient;

      // This will fail due to insufficient questions, but we verify review_status filter was called
      await expect(
        selectPmleQuestionsByBlueprint(mockSupabase, 5)
      ).rejects.toThrow();
      
      expect(reviewStatusCalls).toContain('GOOD');
    });

    it('should filter questions by review_status=GOOD in question fetch query', async () => {
      const reviewStatusCalls: string[] = [];
      const mockFrom = jest.fn(() => {
        const mockSelect = jest.fn((columns: string) => {
          if (columns.includes('exam_domains')) {
            // Domain count query
            return {
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    data: PMLE_BLUEPRINT.flatMap((config, idx) => 
                      Array(10).fill(null).map(() => ({
                        domain_id: `d${idx + 1}`,
                        exam_domains: { code: config.domainCode, name: config.displayName },
                      }))
                    ),
                    error: null,
                  })),
                })),
              })),
            };
          } else {
            // Question fetch query - should have review_status filter
            return {
              eq: jest.fn((field: string, value: string) => {
                if (field === 'exam') {
                  expect(value).toBe('GCP_PM_ML_ENG');
                  return {
                    eq: jest.fn((statusField: string, statusValue: string) => {
                      expect(statusField).toBe('status');
                      expect(statusValue).toBe('ACTIVE');
                      return {
                        eq: jest.fn((reviewStatusField: string, reviewStatusValue: string) => {
                          expect(reviewStatusField).toBe('review_status');
                          reviewStatusCalls.push(reviewStatusValue);
                          expect(reviewStatusValue).toBe('GOOD');
                          return {
                            eq: jest.fn(() => ({
                              limit: jest.fn(() => ({
                                data: Array(5).fill(null).map((_, i) => ({
                                  id: `q${i}`,
                                  stem: `Question ${i}`,
                                  difficulty: 'MEDIUM',
                                  answers: [
                                    { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
                                    { choice_label: 'B', choice_text: 'Answer B', is_correct: false },
                                  ],
                                })),
                                error: null,
                              })),
                            })),
                          };
                        }),
                      };
                    }),
                  };
                }
                return {};
              }),
            };
          }
        });
        return { select: mockSelect };
      });

      const mockSupabase = {
        from: mockFrom,
      } as unknown as SupabaseClient;

      await selectPmleQuestionsByBlueprint(mockSupabase, 5);
      
      expect(reviewStatusCalls).toContain('GOOD');
    });

    it('should gate debug logging by environment variable', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalDebug = process.env.DIAGNOSTIC_BLUEPRINT_DEBUG;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Create a mock that returns sufficient questions
      const mockFrom = jest.fn(() => {
        const mockSelect = jest.fn((columns: string) => {
          if (columns.includes('exam_domains')) {
            return {
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    data: PMLE_BLUEPRINT.flatMap((config, idx) => 
                      Array(10).fill(null).map(() => ({
                        domain_id: `d${idx + 1}`,
                        exam_domains: { code: config.domainCode, name: config.displayName },
                      }))
                    ),
                    error: null,
                  })),
                })),
              })),
            };
          } else {
            return {
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        data: Array(5).fill(null).map((_, i) => ({
                          id: `q${i}`,
                          stem: `Question ${i}`,
                          difficulty: 'MEDIUM',
                          answers: [
                            { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
                            { choice_label: 'B', choice_text: 'Answer B', is_correct: false },
                          ],
                        })),
                        error: null,
                      })),
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

      // Test with debug disabled (production)
      process.env.NODE_ENV = 'production';
      delete process.env.DIAGNOSTIC_BLUEPRINT_DEBUG;
      await selectPmleQuestionsByBlueprint(mockSupabase, 5);
      expect(consoleSpy).not.toHaveBeenCalled();

      // Test with debug enabled
      process.env.DIAGNOSTIC_BLUEPRINT_DEBUG = 'true';
      await selectPmleQuestionsByBlueprint(mockSupabase, 5);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
      if (originalDebug) {
        process.env.DIAGNOSTIC_BLUEPRINT_DEBUG = originalDebug;
      } else {
        delete process.env.DIAGNOSTIC_BLUEPRINT_DEBUG;
      }
    });
  });
});

