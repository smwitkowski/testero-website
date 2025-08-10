/**
 * TypeScript type definitions for Testero content system
 * 
 * This file provides comprehensive type-safe interfaces for all content types
 * in the system, supporting the unified content routing established in TES-326.
 * 
 * These types are validated at runtime using the Zod schemas in schemas.ts
 * and validation utilities in validators.ts.
 */

/**
 * Base content fields shared across all content types
 */
export interface BaseContent {
  /** Required content title */
  title: string;
  /** Content description for SEO and previews */
  description: string;
  /** ISO date string when content was published */
  publishedAt: Date;
  /** ISO date string when content was last updated (optional) */
  updatedAt?: Date;
  /** Array of tags for categorization and filtering */
  tags: string[];
  /** Content author name */
  author: string;
  /** Estimated reading time (e.g., "5 min read") */
  readingTime: string;
  /** SEO configuration (optional) */
  seo?: {
    /** Override meta title (defaults to title) */
    metaTitle?: string;
    /** Override meta description (defaults to description) */
    metaDescription?: string;
    /** Canonical URL for SEO */
    canonicalUrl?: string;
    /** Open Graph image URL */
    ogImage?: string;
    /** Twitter card type */
    twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  };
}

/**
 * Blog post content type
 */
export interface BlogPost extends BaseContent {
  /** Content type identifier */
  category: 'blog';
  /** Blog post slug */
  slug: string;
  /** Whether this post is featured */
  featured?: boolean;
  /** Short excerpt for previews */
  excerpt?: string;
  /** Blog category (e.g., 'certification-guides', 'exam-tips') */
  blogCategory?: string;
}

/**
 * Hub content type - central pillar content that connects related topics
 */
export interface HubContent extends BaseContent {
  /** Content type identifier */
  category: 'hub';
  /** Hub content slug */
  slug: string;
  /** Hub content type (matches legacy system) */
  type: 'hub';
  /** Cover image for the hub */
  coverImage?: string;
  /** Last modified date (legacy support) */
  lastModified?: string;
  /** Date field (legacy support) */
  date: string;
}

/**
 * Spoke content type - detailed content that connects to hub content
 */
export interface SpokeContent extends BaseContent {
  /** Content type identifier */
  category: 'spoke';
  /** Spoke content slug */
  slug: string;
  /** Spoke content type (matches legacy system) */
  type: 'spoke';
  /** Hub slug this spoke belongs to */
  hubSlug?: string;
  /** Order within the hub (for sorting) */
  spokeOrder?: number;
  /** Cover image for the spoke */
  coverImage?: string;
  /** Last modified date (legacy support) */
  lastModified?: string;
  /** Date field (legacy support) */
  date: string;
}

/**
 * Guide content type - step-by-step instructional content
 */
export interface GuideContent extends BaseContent {
  /** Content type identifier */
  category: 'guide';
  /** Guide content slug */
  slug: string;
  /** Difficulty level for the guide */
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  /** Estimated completion time */
  completionTime?: string;
  /** Prerequisites for this guide */
  prerequisites?: string[];
  /** Learning objectives */
  objectives?: string[];
}

/**
 * Documentation content type - technical reference material
 */
export interface DocumentationContent extends BaseContent {
  /** Content type identifier */
  category: 'documentation';
  /** Documentation slug */
  slug: string;
  /** Documentation section */
  section?: string;
  /** API version (for API docs) */
  apiVersion?: string;
  /** Whether this is deprecated */
  deprecated?: boolean;
}

/**
 * FAQ content type - frequently asked questions
 */
export interface FAQContent extends BaseContent {
  /** Content type identifier */
  category: 'faq';
  /** FAQ slug */
  slug: string;
  /** Question text */
  question: string;
  /** Answer content */
  answer: string;
  /** FAQ category for grouping */
  faqCategory?: string;
  /** Priority for ordering (higher = more important) */
  priority?: number;
}

/**
 * Union type for all content types
 */
export type AnyContent = 
  | BlogPost 
  | HubContent 
  | SpokeContent 
  | GuideContent 
  | DocumentationContent 
  | FAQContent;

/**
 * Content type names for runtime checking
 */
export type ContentType = AnyContent['category'];

/**
 * Difficulty levels for guides and other content
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Social card types for sharing
 */
export type TwitterCardType = 'summary' | 'summary_large_image' | 'app' | 'player';

/**
 * Content processing result with HTML output
 */
export interface ProcessedContent<T extends AnyContent = AnyContent> {
  /** Content slug for URL generation */
  slug: string;
  /** Processed HTML content */
  content: string;
  /** Content metadata */
  meta: T;
  /** Content type for routing */
  type: ContentType;
}

/**
 * Content listing item for index pages
 */
export interface ContentListItem {
  /** Content slug */
  slug: string;
  /** Content title */
  title: string;
  /** Content description */
  description: string;
  /** Content type */
  type: ContentType;
  /** Publication date */
  publishedAt: Date;
  /** Tags array */
  tags: string[];
  /** Author name */
  author: string;
  /** Reading time */
  readingTime: string;
  /** Cover image (optional) */
  coverImage?: string;
  /** Whether content is featured */
  featured?: boolean;
}

/**
 * Search result structure
 */
export interface ContentSearchResult extends ContentListItem {
  /** Search relevance score */
  score: number;
  /** Highlighted excerpt showing search matches */
  highlight: string;
}

/**
 * Content navigation structure
 */
export interface ContentNavigation {
  /** Previous content item */
  previous?: {
    title: string;
    slug: string;
    type: ContentType;
  };
  /** Next content item */
  next?: {
    title: string;
    slug: string;
    type: ContentType;
  };
  /** Parent content (for hierarchical content) */
  parent?: {
    title: string;
    slug: string;
    type: ContentType;
  };
  /** Related content items */
  related: Array<{
    title: string;
    slug: string;
    type: ContentType;
    description: string;
    tags: string[];
  }>;
}

/**
 * Content statistics and metrics
 */
export interface ContentStats {
  /** Total word count */
  wordCount: number;
  /** Estimated reading time in minutes */
  readingMinutes: number;
  /** Number of code blocks */
  codeBlocks: number;
  /** Number of images */
  images: number;
  /** Number of external links */
  externalLinks: number;
  /** Content freshness score (0-1) */
  freshnessScore: number;
}

/**
 * Content validation error
 */
export interface ContentValidationError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  code: string;
  /** Field value that caused the error */
  value?: unknown;
}

/**
 * Content validation result
 */
export interface ContentValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Array of validation errors (empty if valid) */
  errors: ContentValidationError[];
  /** Validated and normalized data (only if valid) */
  data?: AnyContent;
}

/**
 * Content frontmatter raw data from markdown files
 */
export interface ContentFrontmatter {
  [key: string]: unknown;
}

/**
 * Content file metadata
 */
export interface ContentFile {
  /** File path relative to content root */
  filePath: string;
  /** File slug derived from filename */
  slug: string;
  /** Content type inferred from directory */
  type: ContentType;
  /** Raw frontmatter data */
  frontmatter: ContentFrontmatter;
  /** Raw markdown content */
  content: string;
  /** File modification time */
  lastModified: Date;
}