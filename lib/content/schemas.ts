/**
 * Zod validation schemas for Testero content system
 * 
 * Provides runtime validation for all content types with helpful error messages.
 * These schemas correspond to the TypeScript interfaces in types.ts and ensure
 * content integrity during processing and publishing.
 */

import { z } from 'zod';

/**
 * Twitter card type validation
 */
export const TwitterCardTypeSchema = z.enum(['summary', 'summary_large_image', 'app', 'player']);

/**
 * Difficulty level validation for guides
 */
export const DifficultyLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

/**
 * Content type validation
 */
export const ContentTypeSchema = z.enum(['blog', 'hub', 'spoke', 'guide', 'documentation', 'faq']);

/**
 * SEO configuration schema
 */
export const SEOSchema = z.object({
  metaTitle: z.string().min(10).max(60).optional(),
  metaDescription: z.string().min(50).max(160).optional(),
  canonicalUrl: z.string().url().optional(),
  ogImage: z.string().url().optional(),
  twitterCard: TwitterCardTypeSchema.optional(),
}).optional();

/**
 * Base content schema with shared fields
 */
export const BaseContentSchema = z.object({
  title: z.string()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title must be less than 100 characters"),
  
  description: z.string()
    .min(20, "Description must be at least 20 characters")
    .max(200, "Description must be less than 200 characters"),
  
  publishedAt: z.date({
    required_error: "Published date is required",
    invalid_type_error: "Published date must be a valid date"
  }),
  
  updatedAt: z.date().optional(),
  
  tags: z.array(z.string())
    .min(1, "At least one tag is required")
    .max(10, "Maximum 10 tags allowed"),
  
  author: z.string()
    .min(2, "Author name must be at least 2 characters")
    .max(50, "Author name must be less than 50 characters"),
  
  readingTime: z.string()
    .regex(/^\d+\s+min\s+read$/, "Reading time must be in format '5 min read'"),
  
  seo: SEOSchema,
});

/**
 * Blog post schema
 */
export const BlogPostSchema = BaseContentSchema.extend({
  category: z.literal('blog'),
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be less than 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  
  featured: z.boolean().optional(),
  
  excerpt: z.string()
    .min(50, "Excerpt must be at least 50 characters")
    .max(300, "Excerpt must be less than 300 characters")
    .optional(),
  
  blogCategory: z.string()
    .min(2, "Blog category must be at least 2 characters")
    .optional(),
});

/**
 * Hub content schema
 */
export const HubContentSchema = BaseContentSchema.extend({
  category: z.literal('hub'),
  type: z.literal('hub'),
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be less than 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  
  coverImage: z.string().url("Cover image must be a valid URL").optional(),
  lastModified: z.string().optional(), // Legacy support
  date: z.string(), // Legacy support
});

/**
 * Spoke content schema
 */
export const SpokeContentSchema = BaseContentSchema.extend({
  category: z.literal('spoke'),
  type: z.literal('spoke'),
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be less than 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  
  hubSlug: z.string()
    .regex(/^[a-z0-9-]+$/, "Hub slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  
  spokeOrder: z.number()
    .int("Spoke order must be an integer")
    .min(0, "Spoke order must be 0 or greater")
    .optional(),
  
  coverImage: z.string().url("Cover image must be a valid URL").optional(),
  lastModified: z.string().optional(), // Legacy support
  date: z.string(), // Legacy support
});

/**
 * Guide content schema
 */
export const GuideContentSchema = BaseContentSchema.extend({
  category: z.literal('guide'),
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be less than 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  
  difficulty: DifficultyLevelSchema.optional(),
  
  completionTime: z.string()
    .regex(/^\d+\s+(minutes?|hours?|days?)$/, "Completion time must be in format '30 minutes' or '2 hours'")
    .optional(),
  
  prerequisites: z.array(z.string())
    .max(10, "Maximum 10 prerequisites allowed")
    .optional(),
  
  objectives: z.array(z.string())
    .min(1, "At least one learning objective is required when objectives are provided")
    .max(15, "Maximum 15 learning objectives allowed")
    .optional(),
});

/**
 * Documentation content schema
 */
export const DocumentationContentSchema = BaseContentSchema.extend({
  category: z.literal('documentation'),
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be less than 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  
  section: z.string()
    .min(2, "Documentation section must be at least 2 characters")
    .optional(),
  
  apiVersion: z.string()
    .regex(/^v?\d+(\.\d+)*(-[a-z0-9-]+)?$/, "API version must be in format 'v1.2.3' or '1.2.3-beta'")
    .optional(),
  
  deprecated: z.boolean().optional(),
});

/**
 * FAQ content schema
 */
export const FAQContentSchema = BaseContentSchema.extend({
  category: z.literal('faq'),
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(100, "Slug must be less than 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  
  question: z.string()
    .min(10, "Question must be at least 10 characters")
    .max(200, "Question must be less than 200 characters"),
  
  answer: z.string()
    .min(20, "Answer must be at least 20 characters")
    .max(2000, "Answer must be less than 2000 characters"),
  
  faqCategory: z.string()
    .min(2, "FAQ category must be at least 2 characters")
    .optional(),
  
  priority: z.number()
    .int("Priority must be an integer")
    .min(0, "Priority must be 0 or greater")
    .max(100, "Priority must be 100 or less")
    .optional(),
});

/**
 * Union schema for all content types
 */
export const AnyContentSchema = z.discriminatedUnion('category', [
  BlogPostSchema,
  HubContentSchema,
  SpokeContentSchema,
  GuideContentSchema,
  DocumentationContentSchema,
  FAQContentSchema,
]);

/**
 * Content frontmatter schema for parsing raw markdown files
 */
export const ContentFrontmatterSchema = z.record(z.unknown());

/**
 * Content validation error schema
 */
export const ContentValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string(),
  value: z.unknown().optional(),
});

/**
 * Content validation result schema
 */
export const ContentValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(ContentValidationErrorSchema),
  data: AnyContentSchema.optional(),
});

/**
 * Schema for content file metadata
 */
export const ContentFileSchema = z.object({
  filePath: z.string(),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  
  type: ContentTypeSchema,
  frontmatter: ContentFrontmatterSchema,
  content: z.string(),
  lastModified: z.date(),
});

/**
 * Schema for content list items (used in index pages)
 */
export const ContentListItemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  type: ContentTypeSchema,
  publishedAt: z.date(),
  tags: z.array(z.string()),
  author: z.string(),
  readingTime: z.string(),
  coverImage: z.string().url().optional(),
  featured: z.boolean().optional(),
});

/**
 * Schema for processed content with HTML output
 */
export const ProcessedContentSchema = z.object({
  slug: z.string(),
  content: z.string(),
  meta: AnyContentSchema,
  type: ContentTypeSchema,
});

/**
 * Schema for content navigation
 */
export const ContentNavigationSchema = z.object({
  previous: z.object({
    title: z.string(),
    slug: z.string(),
    type: ContentTypeSchema,
  }).optional(),
  
  next: z.object({
    title: z.string(),
    slug: z.string(),
    type: ContentTypeSchema,
  }).optional(),
  
  parent: z.object({
    title: z.string(),
    slug: z.string(),
    type: ContentTypeSchema,
  }).optional(),
  
  related: z.array(z.object({
    title: z.string(),
    slug: z.string(),
    type: ContentTypeSchema,
    description: z.string(),
    tags: z.array(z.string()),
  })),
});

/**
 * Schema for content statistics
 */
export const ContentStatsSchema = z.object({
  wordCount: z.number().int().min(0),
  readingMinutes: z.number().min(0),
  codeBlocks: z.number().int().min(0),
  images: z.number().int().min(0),
  externalLinks: z.number().int().min(0),
  freshnessScore: z.number().min(0).max(1),
});

/**
 * Export schema types for TypeScript inference
 */
export type TwitterCardType = z.infer<typeof TwitterCardTypeSchema>;
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;
export type ContentType = z.infer<typeof ContentTypeSchema>;
export type BaseContent = z.infer<typeof BaseContentSchema>;
export type BlogPost = z.infer<typeof BlogPostSchema>;
export type HubContent = z.infer<typeof HubContentSchema>;
export type SpokeContent = z.infer<typeof SpokeContentSchema>;
export type GuideContent = z.infer<typeof GuideContentSchema>;
export type DocumentationContent = z.infer<typeof DocumentationContentSchema>;
export type FAQContent = z.infer<typeof FAQContentSchema>;
export type AnyContent = z.infer<typeof AnyContentSchema>;
export type ContentFrontmatter = z.infer<typeof ContentFrontmatterSchema>;
export type ContentValidationError = z.infer<typeof ContentValidationErrorSchema>;
export type ContentValidationResult = z.infer<typeof ContentValidationResultSchema>;
export type ContentFile = z.infer<typeof ContentFileSchema>;
export type ContentListItem = z.infer<typeof ContentListItemSchema>;
export type ProcessedContent = z.infer<typeof ProcessedContentSchema>;
export type ContentNavigation = z.infer<typeof ContentNavigationSchema>;
export type ContentStats = z.infer<typeof ContentStatsSchema>;