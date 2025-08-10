/**
 * Unified Content Loader System for Testero
 * 
 * Provides centralized content loading, MDX compilation, frontmatter parsing,
 * and caching for all content types in the Testero content system.
 * 
 * Features:
 * - Single `getContent()` function for all content types
 * - MDX compilation with custom components support  
 * - Frontmatter extraction and validation using Zod schemas
 * - File-system based content discovery
 * - Development-time caching for performance
 * - Error handling for malformed content
 * - Support for draft/published content filtering
 */

import * as fs from "fs";
import { promises as fsPromises } from "fs";
import * as path from "path";
import matter from "gray-matter";
import { z } from "zod";

// Simple cache implementation for compatibility
const cache = <T extends (...args: any[]) => any>(fn: T): T => {
  return fn; // In React 19/Next.js 15+, this would be the actual cache function
};

// Import content system components
import { contentCache } from "./cache";
import { processMDX, extractMDXMetadata } from "./mdx";
import { 
  AnyContentSchema, 
  ContentTransformOptionsSchema,
  ContentProcessingResultSchema,
  ContentFileSchema,
  LegacyFrontmatterSchema 
} from "./schemas";
import type { 
  ContentType, 
  AnyContent, 
  ProcessedContent,
  ContentFile,
  ContentTransformOptions,
  ContentProcessingResult,
  ContentListItem,
  ContentFrontmatter
} from "./types";

/**
 * Content system configuration
 */
export const CONTENT_DIRECTORIES: Record<ContentType, string> = {
  blog: path.join(process.cwd(), "app/content/blog"),
  hub: path.join(process.cwd(), "app/content/hub"), 
  spoke: path.join(process.cwd(), "app/content/spokes"),
  guide: path.join(process.cwd(), "app/content/guides"),
  documentation: path.join(process.cwd(), "app/content/docs"),
  faq: path.join(process.cwd(), "app/content/faq"),
};

/**
 * Default processing options for content
 */
const DEFAULT_PROCESSING_OPTIONS: ContentTransformOptions = {
  enableGFM: true,
  enableRawHTML: true,
  generateTOC: false,
  enableSyntaxHighlighting: true,
  generateReadingTime: true,
  generateWordCount: true,
  optimizeImages: true,
  strictValidation: false,
  validateLinks: false,
  validateImages: false,
};

/**
 * Legacy interfaces for backward compatibility
 */
export interface ContentMeta {
  title: string;
  description: string;
  date: string;
  lastModified?: string;
  author?: string;
  category?: string;
  tags?: string[];
  slug: string;
  type: "hub" | "spoke";
  hubSlug?: string;
  spokeOrder?: number;
  coverImage?: string;
  readingTime?: number;
}

export interface Content {
  slug: string;
  content: string;
  meta: ContentMeta;
}

/**
 * Utility functions
 */

// Helper function to check if directory exists
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await fsPromises.access(dirPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Helper function to get file modification time
async function getFileModTime(filePath: string): Promise<Date | null> {
  try {
    const stats = await fsPromises.stat(filePath);
    return stats.mtime;
  } catch {
    return null;
  }
}

// Helper function to generate slug from filename
function generateSlug(filename: string): string {
  return filename.replace(/\.md$/, '').toLowerCase();
}

// Helper function to infer content type from directory path
function inferContentType(filePath: string): ContentType | null {
  const relativePath = path.relative(process.cwd(), filePath);
  
  for (const [type, dir] of Object.entries(CONTENT_DIRECTORIES)) {
    if (relativePath.startsWith(path.relative(process.cwd(), dir))) {
      return type as ContentType;
    }
  }
  
  return null;
}

/**
 * Core Content Processing Functions
 */

// Transform legacy frontmatter to modern schema
function transformLegacyFrontmatter(data: any, contentType: ContentType): Partial<AnyContent> {
  const baseTransform = {
    title: data.title || 'Untitled',
    description: data.description || '',
    publishedAt: data.publishedAt || data.date 
      ? new Date(data.publishedAt || data.date) 
      : new Date(),
    updatedAt: data.updatedAt || data.lastModified 
      ? new Date(data.updatedAt || data.lastModified) 
      : undefined,
    author: data.author || 'Testero Team',
    readingTime: data.readingTime || '5 min read',
    tags: Array.isArray(data.tags) ? data.tags : [],
    category: contentType,
  };

  // Content-type specific transformations
  switch (contentType) {
    case 'blog':
      return {
        ...baseTransform,
        slug: data.slug || generateSlug(data.title || ''),
        featured: Boolean(data.featured),
        excerpt: data.excerpt || '',
        blogCategory: data.blogCategory || data.category,
      };

    case 'hub':
      return {
        ...baseTransform,
        type: 'hub' as const,
        slug: data.slug || generateSlug(data.title || ''),
        coverImage: data.coverImage,
        lastModified: data.lastModified,
        date: data.date || data.publishedAt || new Date().toISOString(),
        category: 'hub' as const,
      };

    case 'spoke':
      return {
        ...baseTransform,
        type: 'spoke' as const,
        slug: data.slug || generateSlug(data.title || ''),
        hubSlug: data.hubSlug,
        spokeOrder: data.spokeOrder ? Number(data.spokeOrder) : undefined,
        coverImage: data.coverImage,
        lastModified: data.lastModified,
        date: data.date || data.publishedAt || new Date().toISOString(),
        category: 'spoke' as const,
      };

    case 'guide':
      return {
        ...baseTransform,
        slug: data.slug || generateSlug(data.title || ''),
        difficulty: data.difficulty as any,
        completionTime: data.completionTime,
        prerequisites: Array.isArray(data.prerequisites) ? data.prerequisites : [],
        objectives: Array.isArray(data.objectives) ? data.objectives : [],
      };

    case 'documentation':
      return {
        ...baseTransform,
        slug: data.slug || generateSlug(data.title || ''),
        section: data.section,
        apiVersion: data.apiVersion,
        deprecated: Boolean(data.deprecated),
      };

    case 'faq':
      return {
        ...baseTransform,
        slug: data.slug || generateSlug(data.title || ''),
        question: data.question || data.title || '',
        answer: data.answer || data.description || '',
        faqCategory: data.faqCategory || data.category,
        priority: data.priority ? Number(data.priority) : undefined,
      };

    default:
      return baseTransform;
  }
}

// Validate and process content frontmatter
function validateContentFrontmatter(
  data: any, 
  contentType: ContentType,
  strictValidation: boolean = false
): { valid: boolean; content?: AnyContent; errors: string[] } {
  const errors: string[] = [];
  
  try {
    // First try modern schema validation
    const transformedData = transformLegacyFrontmatter(data, contentType);
    const validatedContent = AnyContentSchema.parse({
      ...transformedData,
      category: contentType,
      // Ensure all required fields are present
      title: transformedData.title || 'Untitled',
      description: transformedData.description || '',
      publishedAt: transformedData.publishedAt || new Date(),
      tags: transformedData.tags || [],
      author: transformedData.author || 'Testero Team',
      readingTime: transformedData.readingTime || '5 min read',
      slug: (transformedData as any).slug || generateSlug(transformedData.title || ''),
    });
    
    return { valid: true, content: validatedContent, errors: [] };
  } catch (zodError) {
    if (strictValidation) {
      if (zodError instanceof z.ZodError) {
        errors.push(...zodError.errors.map(err => `${err.path.join('.')}: ${err.message}`));
      } else {
        errors.push('Unknown validation error');
      }
      return { valid: false, errors };
    }
    
    // In non-strict mode, try legacy schema as fallback
    try {
      const legacyData = LegacyFrontmatterSchema.parse(data);
      const transformedContent = transformLegacyFrontmatter(legacyData, contentType);
      
      return { 
        valid: true, 
        content: { ...transformedContent, category: contentType } as AnyContent, 
        errors: [`Using legacy schema for content type: ${contentType}`] 
      };
    } catch (legacyError) {
      errors.push('Failed both modern and legacy schema validation');
      if (legacyError instanceof z.ZodError) {
        errors.push(...legacyError.errors.map(err => `${err.path.join('.')}: ${err.message}`));
      }
      return { valid: false, errors };
    }
  }
}

/**
 * Main Content Processing Function
 */
async function processContentFile(
  filePath: string,
  slug: string,
  contentType: ContentType,
  options: Partial<ContentTransformOptions> = {}
): Promise<ContentProcessingResult> {
  const startTime = Date.now();
  const processingOptions = { ...DEFAULT_PROCESSING_OPTIONS, ...options };
  
  try {
    // Check cache first
    const cacheKey = `${contentType}-${slug}-v2`;
    const cached = await contentCache.get<ProcessedContent>(cacheKey, filePath);
    if (cached) {
      return {
        success: true,
        content: cached,
        errors: [],
        warnings: [],
        metadata: {
          processingTime: Date.now() - startTime,
          wordCount: cached.content.split(/\s+/).length,
          readingTimeMinutes: Math.ceil(cached.content.split(/\s+/).length / 200),
          imageCount: 0,
          linkCount: 0,
        }
      };
    }

    // Read and parse file
    const fileContents = await fsPromises.readFile(filePath, 'utf8');
    const { data: frontmatter, content: rawContent } = matter(fileContents);

    // Validate frontmatter
    const validation = validateContentFrontmatter(
      frontmatter, 
      contentType, 
      processingOptions.strictValidation
    );

    if (!validation.valid || !validation.content) {
      return {
        success: false,
        errors: validation.errors.map(error => ({
          field: 'frontmatter',
          message: error,
          code: 'VALIDATION_ERROR'
        })),
        warnings: [],
        metadata: {
          processingTime: Date.now() - startTime,
          wordCount: 0,
          readingTimeMinutes: 0,
          imageCount: 0,
          linkCount: 0,
        }
      };
    }

    // Process MDX content
    const htmlContent = await processMDX(rawContent, processingOptions);
    const contentMetadata = extractMDXMetadata(htmlContent);

    // Update metadata with processing results
    const finalMeta = {
      ...validation.content,
      slug,
      readingTime: processingOptions.generateReadingTime 
        ? `${contentMetadata.readingTimeMinutes} min read`
        : validation.content.readingTime,
    } as AnyContent;

    const processedContent: ProcessedContent = {
      slug,
      content: htmlContent,
      meta: finalMeta,
      type: contentType,
    };

    // Cache the result
    await contentCache.set(cacheKey, processedContent, filePath);

    return {
      success: true,
      content: processedContent,
      errors: [],
      warnings: validation.errors.map(error => ({
        field: 'frontmatter',
        message: error,
        severity: 'low' as const
      })),
      metadata: {
        processingTime: Date.now() - startTime,
        wordCount: contentMetadata.wordCount,
        readingTimeMinutes: contentMetadata.readingTimeMinutes,
        imageCount: contentMetadata.images.length,
        linkCount: contentMetadata.externalLinks.length + contentMetadata.internalLinks.length,
      }
    };

  } catch (error) {
    console.error(`Error processing content file ${filePath}:`, error);
    
    return {
      success: false,
      errors: [{
        field: 'file',
        message: error instanceof Error ? error.message : 'Unknown processing error',
        code: 'PROCESSING_ERROR'
      }],
      warnings: [],
      metadata: {
        processingTime: Date.now() - startTime,
        wordCount: 0,
        readingTimeMinutes: 0,
        imageCount: 0,
        linkCount: 0,
      }
    };
  }
}

/**
 * Public API - Unified Content Loader
 */

/**
 * Get a single piece of content by type and slug
 */
export const getContent = cache(async <T extends ContentType>(
  contentType: T,
  slug: string,
  options?: Partial<ContentTransformOptions>
): Promise<ProcessedContent<Extract<AnyContent, { category: T }>> | null> => {
  try {
    const contentDir = CONTENT_DIRECTORIES[contentType];
    if (!contentDir || !(await directoryExists(contentDir))) {
      console.warn(`Content directory for type '${contentType}' does not exist: ${contentDir}`);
      return null;
    }

    const filePath = path.join(contentDir, `${slug}.md`);
    
    // Check if file exists
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
    } catch {
      return null; // File doesn't exist
    }

    const result = await processContentFile(filePath, slug, contentType, options);
    
    if (!result.success || !result.content) {
      console.error(`Failed to process content ${contentType}/${slug}:`, result.errors);
      return null;
    }

    return result.content as ProcessedContent<Extract<AnyContent, { category: T }>>;

  } catch (error) {
    console.error(`Error fetching ${contentType} content for slug ${slug}:`, error);
    return null;
  }
});

/**
 * Get all content for a specific type with optional filtering
 */
export const getAllContent = cache(async <T extends ContentType>(
  contentType: T,
  options: {
    published?: boolean;
    limit?: number;
    sortBy?: 'publishedAt' | 'updatedAt' | 'title';
    sortOrder?: 'asc' | 'desc';
    processingOptions?: Partial<ContentTransformOptions>;
  } = {}
): Promise<ProcessedContent<Extract<AnyContent, { category: T }>>[]> => {
  try {
    const {
      published = true,
      limit,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      processingOptions
    } = options;

    const contentDir = CONTENT_DIRECTORIES[contentType];
    if (!contentDir || !(await directoryExists(contentDir))) {
      console.warn(`Content directory for type '${contentType}' does not exist: ${contentDir}`);
      return [];
    }

    const fileNames = await fsPromises.readdir(contentDir);
    const contentPromises = fileNames
      .filter(fileName => fileName.endsWith('.md'))
      .map(async (fileName) => {
        const slug = generateSlug(fileName);
        const filePath = path.join(contentDir, fileName);
        
        try {
          const result = await processContentFile(filePath, slug, contentType, processingOptions);
          return result.success ? result.content : null;
        } catch (error) {
          console.error(`Error processing file ${fileName}:`, error);
          return null;
        }
      });

    const allContent = await Promise.all(contentPromises);
    
    // Filter out failed processes and apply published filter
    let filteredContent = allContent
      .filter((content): content is ProcessedContent<Extract<AnyContent, { category: T }>> => 
        content !== null
      );

    // Apply published filter
    if (published) {
      filteredContent = filteredContent.filter(content => {
        const publishedAt = new Date(content.meta.publishedAt);
        return publishedAt <= new Date();
      });
    }

    // Sort content
    filteredContent.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'publishedAt':
          aValue = new Date(a.meta.publishedAt).getTime();
          bValue = new Date(b.meta.publishedAt).getTime();
          break;
        case 'updatedAt':
          aValue = a.meta.updatedAt ? new Date(a.meta.updatedAt).getTime() : 0;
          bValue = b.meta.updatedAt ? new Date(b.meta.updatedAt).getTime() : 0;
          break;
        case 'title':
          aValue = a.meta.title.toLowerCase();
          bValue = b.meta.title.toLowerCase();
          break;
        default:
          aValue = new Date(a.meta.publishedAt).getTime();
          bValue = new Date(b.meta.publishedAt).getTime();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply limit
    if (limit && limit > 0) {
      filteredContent = filteredContent.slice(0, limit);
    }

    return filteredContent;

  } catch (error) {
    console.error(`Error fetching all ${contentType} content:`, error);
    return [];
  }
});

/**
 * Discover all available content files
 */
export const discoverContent = cache(async (): Promise<ContentFile[]> => {
  const allFiles: ContentFile[] = [];

  for (const [contentType, contentDir] of Object.entries(CONTENT_DIRECTORIES)) {
    try {
      if (!(await directoryExists(contentDir))) {
        continue;
      }

      const fileNames = await fsPromises.readdir(contentDir);
      
      for (const fileName of fileNames) {
        if (!fileName.endsWith('.md')) continue;

        const filePath = path.join(contentDir, fileName);
        const slug = generateSlug(fileName);
        const lastModified = await getFileModTime(filePath);

        if (lastModified) {
          try {
            const fileContents = await fsPromises.readFile(filePath, 'utf8');
            const { data: frontmatter, content } = matter(fileContents);

            allFiles.push({
              filePath: path.relative(process.cwd(), filePath),
              slug,
              type: contentType as ContentType,
              frontmatter,
              content,
              lastModified,
            });
          } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error discovering content in ${contentDir}:`, error);
    }
  }

  return allFiles;
});

/**
 * Generate content list items for index pages
 */
export const getContentListItems = cache(async <T extends ContentType>(
  contentType: T,
  options: {
    published?: boolean;
    limit?: number;
    featured?: boolean;
  } = {}
): Promise<ContentListItem[]> => {
  const content = await getAllContent(contentType, {
    published: options.published,
    limit: options.limit,
  });

  let filteredContent = content;

  // Filter by featured if specified
  if (options.featured !== undefined) {
    filteredContent = content.filter(item => {
      // Check if the content has a featured property
      const meta = item.meta as any;
      return Boolean(meta.featured) === options.featured;
    });
  }

  return filteredContent.map(item => ({
    slug: item.slug,
    title: item.meta.title,
    description: item.meta.description,
    type: item.type,
    publishedAt: item.meta.publishedAt,
    tags: item.meta.tags,
    author: item.meta.author,
    readingTime: item.meta.readingTime,
    coverImage: (item.meta as any).coverImage,
    featured: (item.meta as any).featured,
  }));
});

/**
 * Legacy compatibility functions
 */

// Get a single hub content by slug (legacy compatibility)
export const getHubContent = cache(async (slug: string): Promise<Content | null> => {
  const content = await getContent('hub', slug);
  if (!content) return null;

  // Transform to legacy format
  const meta = content.meta as any;
  return {
    slug: content.slug,
    content: content.content,
    meta: {
      title: meta.title,
      description: meta.description,
      date: meta.date || new Date(meta.publishedAt).toISOString(),
      lastModified: meta.lastModified || (meta.updatedAt ? new Date(meta.updatedAt).toISOString() : undefined),
      author: meta.author,
      category: meta.category,
      tags: meta.tags,
      slug: content.slug,
      type: 'hub' as const,
      hubSlug: undefined,
      spokeOrder: undefined,
      coverImage: meta.coverImage,
      readingTime: parseInt(meta.readingTime?.split(' ')[0] || '5'),
    }
  };
});

// Get a single spoke content by slug (legacy compatibility)
export const getSpokeContent = cache(async (slug: string): Promise<Content | null> => {
  const content = await getContent('spoke', slug);
  if (!content) return null;

  // Transform to legacy format
  const meta = content.meta as any;
  return {
    slug: content.slug,
    content: content.content,
    meta: {
      title: meta.title,
      description: meta.description,
      date: meta.date || new Date(meta.publishedAt).toISOString(),
      lastModified: meta.lastModified || (meta.updatedAt ? new Date(meta.updatedAt).toISOString() : undefined),
      author: meta.author,
      category: meta.category,
      tags: meta.tags,
      slug: content.slug,
      type: 'spoke' as const,
      hubSlug: meta.hubSlug,
      spokeOrder: meta.spokeOrder,
      coverImage: meta.coverImage,
      readingTime: parseInt(meta.readingTime?.split(' ')[0] || '5'),
    }
  };
});

// Get all hub content (legacy compatibility)
export const getAllHubContent = cache(async (): Promise<Content[]> => {
  const content = await getAllContent('hub');
  return content.map(item => {
    const meta = item.meta as any;
    return {
      slug: item.slug,
      content: item.content,
      meta: {
        title: meta.title,
        description: meta.description,
        date: meta.date || new Date(meta.publishedAt).toISOString(),
        lastModified: meta.lastModified || (meta.updatedAt ? new Date(meta.updatedAt).toISOString() : undefined),
        author: meta.author,
        category: meta.category,
        tags: meta.tags,
        slug: item.slug,
        type: 'hub' as const,
        hubSlug: undefined,
        spokeOrder: undefined,
        coverImage: meta.coverImage,
        readingTime: parseInt(meta.readingTime?.split(' ')[0] || '5'),
      }
    };
  });
});

// Get all spoke content (legacy compatibility)
export const getAllSpokeContent = cache(async (): Promise<Content[]> => {
  const content = await getAllContent('spoke');
  return content.map(item => {
    const meta = item.meta as any;
    return {
      slug: item.slug,
      content: item.content,
      meta: {
        title: meta.title,
        description: meta.description,
        date: meta.date || new Date(meta.publishedAt).toISOString(),
        lastModified: meta.lastModified || (meta.updatedAt ? new Date(meta.updatedAt).toISOString() : undefined),
        author: meta.author,
        category: meta.category,
        tags: meta.tags,
        slug: item.slug,
        type: 'spoke' as const,
        hubSlug: meta.hubSlug,
        spokeOrder: meta.spokeOrder,
        coverImage: meta.coverImage,
        readingTime: parseInt(meta.readingTime?.split(' ')[0] || '5'),
      }
    };
  });
});

// Get all spoke content for a specific hub (legacy compatibility)
export const getSpokesForHub = cache(async (hubSlug: string): Promise<Content[]> => {
  const allSpokes = await getAllSpokeContent();
  const hubSpokes = allSpokes.filter((spoke) => spoke.meta.hubSlug === hubSlug);

  // Sort by spokeOrder if available, otherwise by date
  return hubSpokes.sort((a, b) => {
    if (a.meta.spokeOrder !== undefined && b.meta.spokeOrder !== undefined) {
      return a.meta.spokeOrder - b.meta.spokeOrder;
    }
    return new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime();
  });
});

// Get all content slugs for generating static paths (legacy compatibility)
export const getAllContentSlugs = cache(async () => {
  const hubContent = await getAllHubContent();
  const spokeContent = await getAllSpokeContent();

  return {
    hubSlugs: hubContent.map((content) => content.slug),
    spokeSlugs: spokeContent.map((content) => content.slug),
  };
});
