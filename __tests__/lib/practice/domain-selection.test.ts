/**
 * @jest-environment node
 */
import { selectPracticeQuestionsByDomains } from '@/lib/practice/domain-selection';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const createMockSupabase = (overrides: Partial<SupabaseClient> = {}): SupabaseClient => {
  return {
    from: jest.fn(),
    ...overrides,
  } as unknown as SupabaseClient;
};

describe('selectPracticeQuestionsByDomains', () => {
  describe('Input Validation', () => {
    it('should reject empty domain codes array', async () => {
      const mockSupabase = createMockSupabase();
      
      await expect(
        selectPracticeQuestionsByDomains(mockSupabase, 'pmle', [], 10)
      ).rejects.toThrow('At least one domain code must be provided');
    });

    it('should reject invalid question count', async () => {
      const mockSupabase = createMockSupabase();
      
      await expect(
        selectPracticeQuestionsByDomains(mockSupabase, 'pmle', ['D1'], 0)
      ).rejects.toThrow('Question count must be greater than 0');
    });

    it('should reject unsupported exam key', async () => {
      const mockSupabase = createMockSupabase();
      
      await expect(
        selectPracticeQuestionsByDomains(mockSupabase, 'invalid', ['D1'], 10)
      ).rejects.toThrow("Unsupported exam key: invalid. Only 'pmle' is currently supported.");
    });
  });

  describe('Domain Metadata Fetching', () => {
    it('should return empty result when no domains found', async () => {
      const mockSupabase = createMockSupabase({
        from: jest.fn((table: string) => {
          if (table === 'exam_domains') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            };
          }
          return {};
        }),
      });

      const result = await selectPracticeQuestionsByDomains(
        mockSupabase,
        'pmle',
        ['INVALID_DOMAIN'],
        10
      );

      expect(result.questions).toEqual([]);
      expect(result.totalSelected).toBe(0);
      expect(result.domainDistribution).toHaveLength(1);
      expect(result.domainDistribution[0].domainCode).toBe('INVALID_DOMAIN');
      expect(result.domainDistribution[0].availableCount).toBe(0);
    });

    it('should handle domain metadata fetch errors', async () => {
      const mockSupabase = createMockSupabase({
        from: jest.fn((table: string) => {
          if (table === 'exam_domains') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' },
                }),
              }),
            };
          }
          return {};
        }),
      });

      await expect(
        selectPracticeQuestionsByDomains(mockSupabase, 'pmle', ['D1'], 10)
      ).rejects.toThrow('Failed to fetch domain metadata: Database error');
    });
  });

  describe('Question Selection', () => {
    it('should select questions from multiple domains with even distribution', async () => {
      const domainMetadata = [
        { id: 'domain-1-id', code: 'D1', name: 'Domain 1' },
        { id: 'domain-2-id', code: 'D2', name: 'Domain 2' },
      ];

      const domainCounts = [
        {
          domain_id: 'domain-1-id',
          exam_domains: { code: 'D1', name: 'Domain 1' },
        },
        {
          domain_id: 'domain-1-id',
          exam_domains: { code: 'D1', name: 'Domain 1' },
        },
        {
          domain_id: 'domain-2-id',
          exam_domains: { code: 'D2', name: 'Domain 2' },
        },
      ];

      const domain1Questions = [
        {
          id: 'q1',
          stem: 'Question 1',
          answers: [
            { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
            { choice_label: 'B', choice_text: 'Answer B', is_correct: false },
          ],
          explanations: [{ id: 'exp1' }],
        },
        {
          id: 'q2',
          stem: 'Question 2',
          answers: [
            { choice_label: 'A', choice_text: 'Answer A', is_correct: false },
            { choice_label: 'B', choice_text: 'Answer B', is_correct: true },
          ],
          explanations: [{ id: 'exp2' }],
        },
      ];

      const domain2Questions = [
        {
          id: 'q3',
          stem: 'Question 3',
          answers: [
            { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
          ],
          explanations: [{ id: 'exp3' }],
        },
      ];

      let callCount = 0;
      const mockSupabase = createMockSupabase({
        from: jest.fn((table: string) => {
          if (table === 'exam_domains') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: domainMetadata,
                  error: null,
                }),
              }),
            };
          }
          if (table === 'questions') {
            callCount++;
            if (callCount === 1) {
              // First call: domain counts query
              return {
                select: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                      eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({
                          data: domainCounts,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              };
            } else {
              // Subsequent calls: individual domain question queries
              const domainId = callCount === 2 ? 'domain-1-id' : 'domain-2-id';
              const questions = domainId === 'domain-1-id' ? domain1Questions : domain2Questions;
              
              return {
                select: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                      eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                          limit: jest.fn().mockResolvedValue({
                            data: questions,
                            error: null,
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              };
            }
          }
          return {};
        }),
      });

      const result = await selectPracticeQuestionsByDomains(
        mockSupabase,
        'pmle',
        ['D1', 'D2'],
        3
      );

      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.totalRequested).toBe(3);
      expect(result.domainDistribution).toHaveLength(2);
      
      // Verify domain distribution includes both domains
      const d1Dist = result.domainDistribution.find(d => d.domainCode === 'D1');
      const d2Dist = result.domainDistribution.find(d => d.domainCode === 'D2');
      expect(d1Dist).toBeDefined();
      expect(d2Dist).toBeDefined();
    });

    it('should handle domains with zero available questions', async () => {
      const domainMetadata = [
        { id: 'domain-1-id', code: 'D1', name: 'Domain 1' },
        { id: 'domain-2-id', code: 'D2', name: 'Domain 2' },
      ];

      // Only D1 has questions
      const domainCounts = [
        {
          domain_id: 'domain-1-id',
          exam_domains: { code: 'D1', name: 'Domain 1' },
        },
      ];

      const domain1Questions = [
        {
          id: 'q1',
          stem: 'Question 1',
          answers: [
            { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
          ],
          explanations: [{ id: 'exp1' }],
        },
      ];

      let callCount = 0;
      const mockSupabase = createMockSupabase({
        from: jest.fn((table: string) => {
          if (table === 'exam_domains') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: domainMetadata,
                  error: null,
                }),
              }),
            };
          }
          if (table === 'questions') {
            callCount++;
            if (callCount === 1) {
              return {
                select: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                      eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({
                          data: domainCounts,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              };
            } else {
              const domainId = callCount === 2 ? 'domain-1-id' : 'domain-2-id';
              const questions = domainId === 'domain-1-id' ? domain1Questions : [];
              
              return {
                select: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                      eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                          limit: jest.fn().mockResolvedValue({
                            data: questions,
                            error: null,
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              };
            }
          }
          return {};
        }),
      });

      const result = await selectPracticeQuestionsByDomains(
        mockSupabase,
        'pmle',
        ['D1', 'D2'],
        10
      );

      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.domainDistribution).toHaveLength(2);
      
      const d1Dist = result.domainDistribution.find(d => d.domainCode === 'D1');
      const d2Dist = result.domainDistribution.find(d => d.domainCode === 'D2');
      
      expect(d1Dist?.selectedCount).toBeGreaterThan(0);
      expect(d2Dist?.selectedCount).toBe(0);
      expect(d2Dist?.availableCount).toBe(0);
    });

    it('should handle some requested domains missing from exam_domains', async () => {
      const domainMetadata = [
        { id: 'domain-1-id', code: 'D1', name: 'Domain 1' },
        // D2 is missing from metadata
      ];

      const domainCounts = [
        {
          domain_id: 'domain-1-id',
          exam_domains: { code: 'D1', name: 'Domain 1' },
        },
      ];

      const domain1Questions = [
        {
          id: 'q1',
          stem: 'Question 1',
          answers: [
            { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
          ],
          explanations: [{ id: 'exp1' }],
        },
      ];

      let callCount = 0;
      const mockSupabase = createMockSupabase({
        from: jest.fn((table: string) => {
          if (table === 'exam_domains') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: domainMetadata,
                  error: null,
                }),
              }),
            };
          }
          if (table === 'questions') {
            callCount++;
            if (callCount === 1) {
              return {
                select: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                      eq: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({
                          data: domainCounts,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              };
            } else {
              return {
                select: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                      eq: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                          limit: jest.fn().mockResolvedValue({
                            data: domain1Questions,
                            error: null,
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              };
            }
          }
          return {};
        }),
      });

      const result = await selectPracticeQuestionsByDomains(
        mockSupabase,
        'pmle',
        ['D1', 'D2'], // D2 doesn't exist
        10
      );

      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.domainDistribution).toHaveLength(2);
      
      const d1Dist = result.domainDistribution.find(d => d.domainCode === 'D1');
      const d2Dist = result.domainDistribution.find(d => d.domainCode === 'D2');
      
      expect(d1Dist?.selectedCount).toBeGreaterThan(0);
      expect(d2Dist?.selectedCount).toBe(0);
      expect(d2Dist?.availableCount).toBe(0);
    });

    it('should filter questions by review_status=GOOD in domain count query', async () => {
      const reviewStatusCalls: string[] = [];
      const domainMetadata = [
        { id: 'domain-1-id', code: 'D1', name: 'Domain 1' },
      ];

      let questionsCallCount = 0;
      const mockSupabase = createMockSupabase({
        from: jest.fn((table: string) => {
          if (table === 'exam_domains') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: domainMetadata,
                  error: null,
                }),
              }),
            };
          }
          if (table === 'questions') {
            questionsCallCount++;
            if (questionsCallCount === 1) {
              // Domain count query - should have review_status filter
              return {
                select: jest.fn().mockReturnValue({
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
                                in: jest.fn().mockResolvedValue({
                                  data: [
                                    {
                                      domain_id: 'domain-1-id',
                                      exam_domains: { code: 'D1', name: 'Domain 1' },
                                    },
                                  ],
                                  error: null,
                                }),
                              };
                            }),
                          };
                        }),
                      };
                    }
                    return {};
                  }),
                }),
              };
            } else {
              // Question fetch query
              return {
                select: jest.fn().mockReturnValue({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        eq: jest.fn(() => ({
                          limit: jest.fn().mockResolvedValue({
                            data: [],
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  })),
                }),
              };
            }
          }
          return {};
        }),
      });

      await selectPracticeQuestionsByDomains(mockSupabase, 'pmle', ['D1'], 5);
      
      expect(reviewStatusCalls).toContain('GOOD');
    });

    it('should filter questions by review_status=GOOD in question fetch query', async () => {
      const reviewStatusCalls: string[] = [];
      const domainMetadata = [
        { id: 'domain-1-id', code: 'D1', name: 'Domain 1' },
      ];

      const domainCounts = [
        {
          domain_id: 'domain-1-id',
          exam_domains: { code: 'D1', name: 'Domain 1' },
        },
      ];

      const domain1Questions = [
        {
          id: 'q1',
          stem: 'Question 1',
          answers: [
            { choice_label: 'A', choice_text: 'Answer A', is_correct: true },
          ],
          explanations: [{ id: 'exp1' }],
        },
      ];

      let callCount = 0;
      const mockSupabase = createMockSupabase({
        from: jest.fn((table: string) => {
          if (table === 'exam_domains') {
            return {
              select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: domainMetadata,
                  error: null,
                }),
              }),
            };
          }
          if (table === 'questions') {
            callCount++;
            if (callCount === 1) {
              // Domain count query
              return {
                select: jest.fn().mockReturnValue({
                  eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                      eq: jest.fn(() => ({
                        in: jest.fn().mockResolvedValue({
                          data: domainCounts,
                          error: null,
                        }),
                      })),
                    })),
                  })),
                }),
              };
            } else {
              // Question fetch query - should have review_status filter
              return {
                select: jest.fn().mockReturnValue({
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
                                  limit: jest.fn().mockResolvedValue({
                                    data: domain1Questions,
                                    error: null,
                                  }),
                                })),
                              };
                            }),
                          };
                        }),
                      };
                    }
                    return {};
                  }),
                }),
              };
            }
          }
          return {};
        }),
      });

      await selectPracticeQuestionsByDomains(mockSupabase, 'pmle', ['D1'], 1);
      
      expect(reviewStatusCalls).toContain('GOOD');
    });
  });
});


