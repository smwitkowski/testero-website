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
 * Content processing stages
 */
export type ContentProcessingStage = 
  | 'raw' 
  | 'parsed' 
  | 'validated' 
  | 'transformed' 
  | 'rendered' 
  | 'optimized' 
  | 'published';

/**
 * Content visibility levels
 */
export type ContentVisibility = 'public' | 'private' | 'draft' | 'archived';

/**
 * Content quality scores
 */
export interface ContentQuality {
  /** Overall quality score (0-100) */
  overall: number;
  /** Content completeness score */
  completeness: number;
  /** SEO optimization score */
  seo: number;
  /** Readability score */
  readability: number;
  /** Technical accuracy score */
  technical: number;
  /** User engagement potential */
  engagement: number;
}

/**
 * Content transformation and processing utilities
 */
export interface ContentTransformOptions {
  /** Enable GitHub Flavored Markdown */
  enableGFM: boolean;
  /** Enable raw HTML processing */
  enableRawHTML: boolean;
  /** Generate table of contents */
  generateTOC: boolean;
  /** Enable syntax highlighting */
  enableSyntaxHighlighting: boolean;
  /** Generate reading time automatically */
  generateReadingTime: boolean;
  /** Generate word count automatically */
  generateWordCount: boolean;
  /** Optimize images during processing */
  optimizeImages: boolean;
  /** Strict validation mode */
  strictValidation: boolean;
  /** Validate external links */
  validateLinks: boolean;
  /** Validate image references */
  validateImages: boolean;
}

/**
 * Content processing pipeline result
 */
export interface ContentProcessingResult {
  /** Processing success status */
  success: boolean;
  /** Processed content (if successful) */
  content?: ProcessedContent;
  /** Validation errors */
  errors: ContentValidationError[];
  /** Processing warnings */
  warnings: Array<{
    field: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  /** Processing metadata */
  metadata: {
    processingTime: number;
    wordCount: number;
    readingTimeMinutes: number;
    imageCount: number;
    linkCount: number;
  };
}

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
  /** Search result context */
  context?: {
    /** Search query that produced this result */
    query: string;
    /** Matching fields */
    matchedFields: string[];
    /** Search result rank */
    rank: number;
    /** Related suggestions */
    suggestions: string[];
  };
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
  /** Additional metrics */
  metrics?: {
    /** Number of internal links */
    internalLinks: number;
    /** Number of headings */
    headings: number;
    /** Complexity score based on readability */
    complexityScore: number;
    /** SEO keyword density */
    keywordDensity: number;
    /** Language level (reading grade) */
    readingLevel: number;
  };
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
 * Legacy content metadata for backward compatibility
 * Matches the existing loader interface
 */
export interface LegacyContentMeta {
  title: string;
  description: string;
  date: string;
  lastModified?: string;
  author?: string;
  category?: string;
  tags?: string[];
  slug: string;
  type: 'hub' | 'spoke';
  hubSlug?: string;
  spokeOrder?: number;
  coverImage?: string;
  readingTime?: number;
}

/**
 * Legacy content structure for backward compatibility
 */
export interface LegacyContent {
  slug: string;
  content: string;
  meta: LegacyContentMeta;
}

/**
 * Content migration status and information
 */
export interface ContentMigrationInfo {
  /** Whether content has been migrated to new schema */
  migrated: boolean;
  /** Schema version used */
  schemaVersion: string;
  /** Migration timestamp */
  migratedAt?: Date;
  /** Original format detected */
  originalFormat: 'legacy' | 'modern';
  /** Migration warnings or issues */
  migrationWarnings: string[];
}

/**
 * Extended content with migration information
 */
export interface MigratableContent<T extends AnyContent = AnyContent> extends ProcessedContent<T> {
  migration: ContentMigrationInfo;
}

/**
 * Content indexing and search metadata
 */
export interface ContentIndex {
  /** Content ID for indexing */
  id: string;
  /** Full text search content */
  searchableText: string;
  /** Search keywords extracted from content */
  keywords: string[];
  /** Content categories for faceted search */
  categories: string[];
  /** Indexed date */
  indexedAt: Date;
  /** Search ranking score */
  rankingScore: number;
}

/**
 * Content relationship mapping
 */
export interface ContentRelationship {
  /** Source content ID */
  fromId: string;
  /** Target content ID */
  toId: string;
  /** Relationship type */
  type: 'related' | 'parent' | 'child' | 'prerequisite' | 'follows' | 'references';
  /** Relationship strength (0-1) */
  strength: number;
  /** Relationship context or reason */
  context?: string;
}

/**
 * Content analytics and performance data
 */
export interface ContentAnalytics {
  /** Unique page views */
  views: number;
  /** Average time on page (seconds) */
  averageTimeOnPage: number;
  /** Bounce rate (0-1) */
  bounceRate: number;
  /** Social shares count */
  shares: number;
  /** Comments count */
  comments: number;
  /** User engagement score (0-100) */
  engagementScore: number;
  /** SEO performance score (0-100) */
  seoScore: number;
  /** Last analytics update */
  lastUpdated: Date;
}

/**
 * Content system configuration
 */
export interface ContentSystemConfig {
  /** Content directories */
  directories: {
    blog: string;
    hub: string;
    spoke: string;
    guide: string;
    documentation: string;
    faq: string;
  };
  /** Default processing options */
  defaultOptions: ContentTransformOptions;
  /** Cache configuration */
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  /** Validation settings */
  validation: {
    strict: boolean;
    allowLegacyFormat: boolean;
    autoMigrate: boolean;
  };
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