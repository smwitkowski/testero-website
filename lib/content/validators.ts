/**
 * Content validation utilities for Testero content system
 * 
 * Provides high-level validation functions with detailed error reporting,
 * type inference, and helpful utilities for content processing pipelines.
 */

import { z } from 'zod';
import {
  AnyContentSchema,
  BlogPostSchema,
  HubContentSchema,
  SpokeContentSchema,
  GuideContentSchema,
  DocumentationContentSchema,
  FAQContentSchema,
  ContentFrontmatterSchema,
  ContentFileSchema,
  ContentListItemSchema,
  ProcessedContentSchema,
  ContentNavigationSchema,
  ContentStatsSchema,
  type ContentType,
  type AnyContent,
  type ContentValidationError,
  type ContentValidationResult,
  type ContentFrontmatter,
} from './schemas';

/**
 * Map content types to their corresponding schemas
 */
const CONTENT_TYPE_SCHEMAS = {
  blog: BlogPostSchema,
  hub: HubContentSchema,
  spoke: SpokeContentSchema,
  guide: GuideContentSchema,
  documentation: DocumentationContentSchema,
  faq: FAQContentSchema,
} as const;

/**
 * Convert Zod errors to our standardized error format
 */
function formatZodError(error: z.ZodError, originalData?: unknown): ContentValidationError[] {
  return error.errors.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
    value: issue.path.length > 0 && originalData ? getNestedValue(originalData, issue.path) : originalData,
  }));
}

/**
 * Helper function to get nested value from object using path array
 */
function getNestedValue(obj: any, path: (string | number)[]): unknown {
  return path.reduce((current, key) => {
    return current && typeof current === 'object' ? current[key] : undefined;
  }, obj);
}

/**
 * Validate any content type using discriminated union
 */
export function validateContent(data: unknown): ContentValidationResult {
  try {
    const validData = AnyContentSchema.parse(data);
    return {
      valid: true,
      errors: [],
      data: validData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodError(error, data),
      };
    }
    
    return {
      valid: false,
      errors: [{
        field: 'root',
        message: 'Unexpected validation error',
        code: 'unknown_error',
        value: data,
      }],
    };
  }
}

/**
 * Validate content for a specific type
 */
export function validateContentByType(
  data: unknown,
  contentType: ContentType
): ContentValidationResult {
  const schema = CONTENT_TYPE_SCHEMAS[contentType];
  
  if (!schema) {
    return {
      valid: false,
      errors: [{
        field: 'category',
        message: `Unknown content type: ${contentType}`,
        code: 'invalid_enum_value',
        value: contentType,
      }],
    };
  }

  try {
    const validData = schema.parse(data);
    return {
      valid: true,
      errors: [],
      data: validData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodError(error, data),
      };
    }
    
    return {
      valid: false,
      errors: [{
        field: 'root',
        message: 'Unexpected validation error',
        code: 'unknown_error',
        value: data,
      }],
    };
  }
}

/**
 * Validate blog post content
 */
export function validateBlogPost(data: unknown): ContentValidationResult {
  return validateContentByType(data, 'blog');
}

/**
 * Validate hub content
 */
export function validateHubContent(data: unknown): ContentValidationResult {
  return validateContentByType(data, 'hub');
}

/**
 * Validate spoke content
 */
export function validateSpokeContent(data: unknown): ContentValidationResult {
  return validateContentByType(data, 'spoke');
}

/**
 * Validate guide content
 */
export function validateGuideContent(data: unknown): ContentValidationResult {
  return validateContentByType(data, 'guide');
}

/**
 * Validate documentation content
 */
export function validateDocumentationContent(data: unknown): ContentValidationResult {
  return validateContentByType(data, 'documentation');
}

/**
 * Validate FAQ content
 */
export function validateFAQContent(data: unknown): ContentValidationResult {
  return validateContentByType(data, 'faq');
}

/**
 * Validate content frontmatter from markdown files
 */
export function validateContentFrontmatter(data: unknown): { valid: boolean; errors: ContentValidationError[]; data?: ContentFrontmatter } {
  try {
    const validData = ContentFrontmatterSchema.parse(data);
    return {
      valid: true,
      errors: [],
      data: validData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodError(error, data),
      };
    }
    
    return {
      valid: false,
      errors: [{
        field: 'root',
        message: 'Invalid frontmatter format',
        code: 'invalid_type',
        value: data,
      }],
    };
  }
}

/**
 * Validate content file metadata
 */
export function validateContentFile(data: unknown) {
  try {
    const validData = ContentFileSchema.parse(data);
    return {
      valid: true,
      errors: [],
      data: validData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodError(error, data),
      };
    }
    
    return {
      valid: false,
      errors: [{
        field: 'root',
        message: 'Invalid content file format',
        code: 'invalid_type',
        value: data,
      }],
    };
  }
}

/**
 * Validate content list item
 */
export function validateContentListItem(data: unknown) {
  try {
    const validData = ContentListItemSchema.parse(data);
    return {
      valid: true,
      errors: [],
      data: validData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodError(error, data),
      };
    }
    
    return {
      valid: false,
      errors: [{
        field: 'root',
        message: 'Invalid content list item format',
        code: 'invalid_type',
        value: data,
      }],
    };
  }
}

/**
 * Validate processed content with HTML
 */
export function validateProcessedContent(data: unknown) {
  try {
    const validData = ProcessedContentSchema.parse(data);
    return {
      valid: true,
      errors: [],
      data: validData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodError(error, data),
      };
    }
    
    return {
      valid: false,
      errors: [{
        field: 'root',
        message: 'Invalid processed content format',
        code: 'invalid_type',
        value: data,
      }],
    };
  }
}

/**
 * Validate content navigation structure
 */
export function validateContentNavigation(data: unknown) {
  try {
    const validData = ContentNavigationSchema.parse(data);
    return {
      valid: true,
      errors: [],
      data: validData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodError(error, data),
      };
    }
    
    return {
      valid: false,
      errors: [{
        field: 'root',
        message: 'Invalid content navigation format',
        code: 'invalid_type',
        value: data,
      }],
    };
  }
}

/**
 * Validate content statistics
 */
export function validateContentStats(data: unknown) {
  try {
    const validData = ContentStatsSchema.parse(data);
    return {
      valid: true,
      errors: [],
      data: validData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodError(error, data),
      };
    }
    
    return {
      valid: false,
      errors: [{
        field: 'root',
        message: 'Invalid content stats format',
        code: 'invalid_type',
        value: data,
      }],
    };
  }
}

/**
 * Type-safe content validator that infers the specific content type
 */
export function validateAndInferContentType<T extends ContentType>(
  data: unknown,
  expectedType: T
): data is Extract<AnyContent, { category: T }> {
  const result = validateContentByType(data, expectedType);
  return result.valid;
}

/**
 * Utility to check if data is valid content without validation
 * (useful for type guards)
 */
export function isValidContent(data: unknown): data is AnyContent {
  return validateContent(data).valid;
}

/**
 * Utility to safely parse content with fallback
 */
export function safeParseContent<T = AnyContent>(
  data: unknown,
  fallback?: T
): T | AnyContent | null {
  const result = validateContent(data);
  
  if (result.valid && result.data) {
    return result.data as T;
  }
  
  if (fallback !== undefined) {
    return fallback;
  }
  
  return null;
}

/**
 * Batch validate multiple content items
 */
export function validateContentBatch(items: unknown[]): {
  valid: number;
  invalid: number;
  results: ContentValidationResult[];
  validItems: AnyContent[];
  errors: Array<{ index: number; errors: ContentValidationError[] }>;
} {
  const results = items.map(item => validateContent(item));
  const validResults = results.filter(r => r.valid);
  const invalidResults = results.map((result, index) => ({ index, errors: result.errors }))
    .filter(item => item.errors.length > 0);
  
  return {
    valid: validResults.length,
    invalid: results.length - validResults.length,
    results,
    validItems: validResults.map(r => r.data!),
    errors: invalidResults,
  };
}

/**
 * Generate human-readable error summary
 */
export function generateErrorSummary(errors: ContentValidationError[]): string {
  if (errors.length === 0) {
    return 'No errors found.';
  }
  
  const errorsByField = errors.reduce((acc, error) => {
    acc[error.field] = acc[error.field] || [];
    acc[error.field].push(error.message);
    return acc;
  }, {} as Record<string, string[]>);
  
  const summaryLines = Object.entries(errorsByField).map(
    ([field, messages]) => `${field}: ${messages.join(', ')}`
  );
  
  return `Found ${errors.length} validation error${errors.length === 1 ? '' : 's'}:\n${summaryLines.join('\n')}`;
}

/**
 * Content type detection based on discriminated union
 */
export function detectContentType(data: unknown): ContentType | null {
  if (typeof data === 'object' && data !== null && 'category' in data) {
    const category = (data as any).category;
    
    if (typeof category === 'string' && category in CONTENT_TYPE_SCHEMAS) {
      return category as ContentType;
    }
  }
  
  return null;
}

/**
 * Validate content structure without full validation (lightweight check)
 */
export function hasRequiredFields(data: unknown, contentType: ContentType): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  
  // Check basic required fields
  const hasBasicFields = [
    'title',
    'description',
    'publishedAt',
    'tags',
    'author',
    'readingTime',
    'category',
    'slug',
  ].every(field => field in obj);
  
  // Check category matches expected type
  const hasCorrectCategory = obj.category === contentType;
  
  return hasBasicFields && hasCorrectCategory;
}

/**
 * Generate JSON schema for IDE autocomplete and external tooling
 */
export function generateJSONSchema(contentType?: ContentType) {
  if (contentType) {
    const schema = CONTENT_TYPE_SCHEMAS[contentType];
    return schema ? JSON.stringify(schema._def, null, 2) : null;
  }
  
  // Return schema for all content types
  return JSON.stringify(AnyContentSchema._def, null, 2);
}

/**
 * Export JSON schemas as static objects for external tools
 */
export const JSON_SCHEMAS = {
  blog: BlogPostSchema,
  hub: HubContentSchema,
  spoke: SpokeContentSchema,
  guide: GuideContentSchema,
  documentation: DocumentationContentSchema,
  faq: FAQContentSchema,
  any: AnyContentSchema,
  frontmatter: ContentFrontmatterSchema,
  file: ContentFileSchema,
  listItem: ContentListItemSchema,
  processed: ProcessedContentSchema,
  navigation: ContentNavigationSchema,
  stats: ContentStatsSchema,
} as const;

/**
 * Export commonly used schemas for external validation
 */
export {
  AnyContentSchema,
  BlogPostSchema,
  HubContentSchema,
  SpokeContentSchema,
  GuideContentSchema,
  DocumentationContentSchema,
  FAQContentSchema,
  ContentFrontmatterSchema,
  ContentFileSchema,
  ContentListItemSchema,
  ProcessedContentSchema,
  ContentNavigationSchema,
  ContentStatsSchema,
};