/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for content validation system
 * 
 * Ensures that all content types validate correctly and error messages
 * are helpful for content creators.
 */

import {
  validateContent,
  validateBlogPost,
  validateGuideContent,
  // validateHubContent,
  // validateSpokeContent,
  // validateDocumentationContent,
  // validateFAQContent,
  generateErrorSummary,
  detectContentType,
  hasRequiredFields,
  isValidContent,
  safeParseContent,
  validateContentBatch,
} from '../validators';

describe('Content Validation', () => {
  // Valid blog post for testing
  const validBlogPost = {
    category: 'blog' as const,
    slug: 'test-blog-post',
    title: 'Test Blog Post',
    description: 'This is a test blog post description that meets the minimum length requirements.',
    publishedAt: new Date('2024-01-01'),
    tags: ['test', 'blog'],
    author: 'Test Author',
    readingTime: '5 min read',
  };

  // Valid guide for testing
  const validGuide = {
    category: 'guide' as const,
    slug: 'test-guide',
    title: 'Test Guide',
    description: 'This is a test guide description that meets the minimum length requirements.',
    publishedAt: new Date('2024-01-01'),
    tags: ['test', 'guide'],
    author: 'Test Author',
    readingTime: '10 min read',
    difficulty: 'beginner' as const,
    completionTime: '30 minutes',
    objectives: ['Learn something new'],
  };

  describe('validateContent', () => {
    test('validates valid blog post', () => {
      const result = validateContent(validBlogPost);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    test('validates valid guide', () => {
      const result = validateContent(validGuide);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    test('rejects invalid data', () => {
      const result = validateContent({ invalid: 'data' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data).toBeUndefined();
    });

    test('provides helpful error messages', () => {
      const invalidBlogPost = {
        ...validBlogPost,
        title: 'Hi', // Too short
        description: 'Short', // Too short
        tags: [], // Empty array
        readingTime: 'invalid format', // Wrong format
      };

      const result = validateContent(invalidBlogPost);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'title',
          message: expect.stringContaining('at least 5 characters'),
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'description',
          message: expect.stringContaining('at least 20 characters'),
        })
      );
    });
  });

  describe('specific type validators', () => {
    test('validateBlogPost works correctly', () => {
      const result = validateBlogPost(validBlogPost);
      expect(result.valid).toBe(true);
    });

    test('validateGuideContent works correctly', () => {
      const result = validateGuideContent(validGuide);
      expect(result.valid).toBe(true);
    });

    test('rejects wrong content type', () => {
      const result = validateBlogPost(validGuide); // Guide passed to blog validator
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'category',
          code: 'invalid_literal',
        })
      );
    });
  });

  describe('utility functions', () => {
    test('detectContentType identifies content type correctly', () => {
      expect(detectContentType(validBlogPost)).toBe('blog');
      expect(detectContentType(validGuide)).toBe('guide');
      expect(detectContentType({ invalid: 'data' })).toBe(null);
      expect(detectContentType({ category: 'invalid' })).toBe(null);
    });

    test('hasRequiredFields checks basic structure', () => {
      expect(hasRequiredFields(validBlogPost, 'blog')).toBe(true);
      expect(hasRequiredFields({ title: 'Test' }, 'blog')).toBe(false);
      expect(hasRequiredFields(validBlogPost, 'guide')).toBe(false); // Wrong type
    });

    test('isValidContent type guard works', () => {
      expect(isValidContent(validBlogPost)).toBe(true);
      expect(isValidContent({ invalid: 'data' })).toBe(false);
    });

    test('safeParseContent handles errors gracefully', () => {
      const validResult = safeParseContent(validBlogPost);
      expect(validResult).toBeDefined();
      expect(validResult && 'category' in validResult && validResult.category).toBe('blog');

      const invalidResult = safeParseContent({ invalid: 'data' });
      expect(invalidResult).toBe(null);

      const fallbackResult = safeParseContent({ invalid: 'data' }, { fallback: true });
      expect(fallbackResult).toEqual({ fallback: true });
    });

    test('generateErrorSummary creates readable output', () => {
      const errors = [
        {
          field: 'title',
          message: 'Title too short',
          code: 'too_small',
          value: 'Hi',
        },
        {
          field: 'description',
          message: 'Description too short',
          code: 'too_small',
          value: 'Short',
        },
      ];

      const summary = generateErrorSummary(errors);
      expect(summary).toContain('2 validation errors');
      expect(summary).toContain('title: Title too short');
      expect(summary).toContain('description: Description too short');
    });
  });

  describe('batch validation', () => {
    test('validates multiple items correctly', () => {
      const items = [validBlogPost, validGuide, { invalid: 'data' }];
      const result = validateContentBatch(items);

      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(1);
      expect(result.validItems).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(2);
    });
  });

  describe('SEO validation', () => {
    test('validates SEO fields when present', () => {
      const blogWithSEO = {
        ...validBlogPost,
        seo: {
          metaTitle: 'Custom Meta Title',
          metaDescription: 'Custom meta description that is long enough to pass validation.',
          canonicalUrl: 'https://example.com/blog/test',
          ogImage: 'https://example.com/og-image.jpg',
          twitterCard: 'summary_large_image' as const,
        },
      };

      const result = validateContent(blogWithSEO);
      expect(result.valid).toBe(true);
    });

    test('rejects invalid SEO fields', () => {
      const blogWithInvalidSEO = {
        ...validBlogPost,
        seo: {
          metaTitle: 'Short', // Too short
          metaDescription: 'Short', // Too short
          canonicalUrl: 'invalid-url', // Invalid URL
          ogImage: 'invalid-url', // Invalid URL
          twitterCard: 'invalid' as any, // Invalid enum value
        },
      };

      const result = validateContent(blogWithInvalidSEO);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('guide-specific validation', () => {
    test('validates difficulty levels', () => {
      const guideWithDifficulty = {
        ...validGuide,
        difficulty: 'advanced' as const,
      };

      const result = validateGuideContent(guideWithDifficulty);
      expect(result.valid).toBe(true);
    });

    test('rejects invalid difficulty', () => {
      const guideWithInvalidDifficulty = {
        ...validGuide,
        difficulty: 'expert' as any, // Invalid difficulty
      };

      const result = validateGuideContent(guideWithInvalidDifficulty);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'difficulty',
          code: 'invalid_enum_value',
        })
      );
    });

    test('validates completion time format', () => {
      const validCompletionTimes = ['30 minutes', '2 hours', '1 day', '45 minutes'];
      const invalidCompletionTimes = ['30 mins', '2 hrs', 'quickly', '30'];

      validCompletionTimes.forEach((time) => {
        const guide = { ...validGuide, completionTime: time };
        const result = validateGuideContent(guide);
        expect(result.valid).toBe(true);
      });

      invalidCompletionTimes.forEach((time) => {
        const guide = { ...validGuide, completionTime: time };
        const result = validateGuideContent(guide);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('slug validation', () => {
    test('validates correct slug format', () => {
      const validSlugs = ['test-post', 'hello-world', 'guide-123', 'a-b-c'];
      
      validSlugs.forEach((slug) => {
        const post = { ...validBlogPost, slug };
        const result = validateBlogPost(post);
        expect(result.valid).toBe(true);
      });
    });

    test('rejects invalid slug format', () => {
      const invalidSlugs = ['Test Post', 'test_post', 'test/post', 'test post', 'Test-Post'];
      
      invalidSlugs.forEach((slug) => {
        const post = { ...validBlogPost, slug };
        const result = validateBlogPost(post);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'slug',
            message: expect.stringContaining('lowercase letters, numbers, and hyphens'),
          })
        );
      });
    });
  });
});