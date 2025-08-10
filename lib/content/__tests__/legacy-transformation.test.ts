/**
 * Tests for legacy content transformation functionality
 * 
 * Ensures that existing content can be transformed to the new schema format
 * without losing data or breaking compatibility.
 */

import {
  transformLegacyContent,
  processContent,
  validateTransformOptions,
} from '../validators';

describe('Legacy Content Transformation', () => {
  // Example of existing hub content format
  const legacyHubContent = {
    title: 'The Ultimate Google Cloud Certification Guide for 2025',
    description: 'A comprehensive roadmap to Google Cloud certifications – which one to choose, how to prepare, and what to expect on exam day.',
    date: '2025-05-03',
    author: 'Testero Team',
    tags: ['Google Cloud', 'Certification', 'Cloud Computing', 'Career Development'],
    coverImage: '/images/google-cloud-certification-guide.jpg',
  };

  // Example of existing blog content with different category format
  const legacyBlogContent = {
    title: '5 Hardest PMLE Questions (With Expert Solutions) - 2025',
    description: 'These 5 PMLE questions fail 70% of candidates—even experienced ML engineers. Master them with expert explanations, code examples, and proven strategies.',
    publishedAt: '2025-08-10',
    updatedAt: '2025-08-10',
    category: 'practice-questions', // Different from content type
    tags: ['PMLE', 'practice questions', 'exam prep'],
    author: 'Testero Team',
    featured: false,
    excerpt: 'Our analysis of thousands of practice attempts shows that these 5 questions trip up nearly 70% of test-takers',
  };

  describe('transformLegacyContent', () => {
    test('transforms legacy hub content successfully', () => {
      const result = transformLegacyContent(legacyHubContent, 'hub', 'google-cloud-certification-guide');
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.category).toBe('hub');
        expect(result.data.slug).toBe('google-cloud-certification-guide');
        expect(result.data.title).toBe(legacyHubContent.title);
        expect(result.data.description).toBe(legacyHubContent.description);
        expect(result.data.tags).toEqual(legacyHubContent.tags);
        expect(result.data.author).toBe(legacyHubContent.author);
        expect(result.data.coverImage).toBe(legacyHubContent.coverImage);
      }
    });

    test('transforms legacy blog content successfully', () => {
      const result = transformLegacyContent(legacyBlogContent, 'blog', '5-hardest-pmle-questions');
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.category).toBe('blog');
        expect(result.data.slug).toBe('5-hardest-pmle-questions');
        expect(result.data.title).toBe(legacyBlogContent.title);
        expect(result.data.featured).toBe(false);
        expect(result.data.excerpt).toBe(legacyBlogContent.excerpt);
      }
    });

    test('handles content with missing date by using current date', () => {
      const contentWithoutDate = {
        title: 'Test Content',
        description: 'This is a test content without a specific publication date.',
        author: 'Test Author',
        tags: ['test'],
      };

      const result = transformLegacyContent(contentWithoutDate, 'guide', 'test-guide');
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.publishedAt).toBeInstanceOf(Date);
      }
    });

    test('generates reading time automatically', () => {
      const result = transformLegacyContent(legacyHubContent, 'hub', 'test-hub');
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.readingTime).toMatch(/\d+ min read/);
      }
    });

    test('rejects invalid legacy content', () => {
      const invalidContent = {
        // Missing required fields
        title: 'Test',
      };

      const result = transformLegacyContent(invalidContent, 'blog', 'test-blog');
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('processContent', () => {
    test('processes legacy content with warnings', () => {
      const result = processContent(
        legacyHubContent, 
        'hub', 
        'test-hub',
        {
          enableGFM: true,
          enableRawHTML: false,
          generateTOC: false,
          enableSyntaxHighlighting: true,
          generateReadingTime: true,
          generateWordCount: true,
          optimizeImages: false,
          strictValidation: false,
          validateLinks: false,
          validateImages: false,
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'schema',
          message: 'Content was transformed from legacy format',
          severity: 'medium',
        })
      );
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('processes modern content without warnings', () => {
      const modernContent = {
        category: 'blog',
        slug: 'test-blog',
        title: 'Modern Blog Post',
        description: 'This is a modern blog post that follows the new schema format perfectly.',
        publishedAt: new Date('2024-01-01'),
        tags: ['test', 'modern'],
        author: 'Test Author',
        readingTime: '3 min read',
      };

      const result = processContent(modernContent, 'blog', 'test-blog');
      
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.warnings).toHaveLength(0);
    });

    test('fails processing invalid content', () => {
      const invalidContent = {
        title: 'Hi', // Too short
      };

      const result = processContent(invalidContent, 'blog', 'test-blog');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateTransformOptions', () => {
    test('validates correct transform options', () => {
      const options = {
        enableGFM: true,
        enableRawHTML: true,
        generateTOC: false,
        enableSyntaxHighlighting: true,
        generateReadingTime: true,
        generateWordCount: true,
        optimizeImages: false,
        strictValidation: false,
        validateLinks: false,
        validateImages: false,
      };

      const result = validateTransformOptions(options);
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('applies default values for missing options', () => {
      const partialOptions = {
        enableGFM: false,
        strictValidation: true,
      };

      const result = validateTransformOptions(partialOptions);
      
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.enableGFM).toBe(false);
        expect(result.data.strictValidation).toBe(true);
        expect(result.data.generateReadingTime).toBe(true); // Default value
      }
    });

    test('rejects invalid transform options', () => {
      const invalidOptions = {
        enableGFM: 'yes', // Should be boolean
        invalidOption: true,
      };

      const result = validateTransformOptions(invalidOptions);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});