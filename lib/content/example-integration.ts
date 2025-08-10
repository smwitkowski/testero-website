/**
 * Example integration of content validation system
 * 
 * This file demonstrates how to integrate the Zod validation system
 * with existing content processing pipelines. It shows best practices
 * for handling validation errors and type-safe content operations.
 */

import { validateContent, validateContentByType, generateErrorSummary } from './validators';
import type { AnyContent, ContentType, ContentValidationResult } from './types';
import matter from 'gray-matter';

/**
 * Example: Process markdown file with validation
 */
export async function processMarkdownWithValidation(
  filePath: string,
  rawContent: string,
  expectedType?: ContentType
): Promise<{
  success: boolean;
  content?: AnyContent;
  html?: string;
  errors?: string[];
}> {
  try {
    // Parse frontmatter
    const { data: frontmatter, content: markdownContent } = matter(rawContent);
    
    // Add slug from filename if not present
    if (!frontmatter.slug) {
      frontmatter.slug = filePath
        .split('/')
        .pop()
        ?.replace(/\.mdx?$/, '')
        ?.toLowerCase()
        ?.replace(/[^a-z0-9-]/g, '-') || 'unknown-slug';
    }

    // Convert date strings to Date objects
    if (frontmatter.publishedAt && typeof frontmatter.publishedAt === 'string') {
      frontmatter.publishedAt = new Date(frontmatter.publishedAt);
    }
    if (frontmatter.updatedAt && typeof frontmatter.updatedAt === 'string') {
      frontmatter.updatedAt = new Date(frontmatter.updatedAt);
    }

    // Validate content
    let validationResult: ContentValidationResult;
    
    if (expectedType) {
      validationResult = validateContentByType(frontmatter, expectedType);
    } else {
      validationResult = validateContent(frontmatter);
    }

    if (!validationResult.valid) {
      return {
        success: false,
        errors: [
          `Validation failed for ${filePath}:`,
          generateErrorSummary(validationResult.errors),
        ],
      };
    }

    // Process markdown to HTML (simplified example)
    const html = markdownContent; // In real implementation, use remark/rehype

    return {
      success: true,
      content: validationResult.data!,
      html,
    };

  } catch (error) {
    return {
      success: false,
      errors: [`Failed to process ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Example: Batch validate content directory
 */
export async function validateContentDirectory(
  contentDir: string,
  contentType: ContentType
): Promise<{
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  errors: Array<{ file: string; errors: string[] }>;
}> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  try {
    const files = await fs.readdir(contentDir);
    const markdownFiles = files.filter(file => /\.mdx?$/.test(file));
    
    const results = await Promise.all(
      markdownFiles.map(async (file) => {
        const filePath = path.join(contentDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        const result = await processMarkdownWithValidation(filePath, content, contentType);
        
        return {
          file,
          success: result.success,
          errors: result.errors || [],
        };
      })
    );

    const validResults = results.filter(r => r.success);
    const invalidResults = results.filter(r => !r.success);

    return {
      totalFiles: markdownFiles.length,
      validFiles: validResults.length,
      invalidFiles: invalidResults.length,
      errors: invalidResults.map(r => ({ file: r.file, errors: r.errors })),
    };

  } catch (error) {
    throw new Error(`Failed to validate directory ${contentDir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Example: Type-safe content getter with validation
 */
export async function getValidatedContent<T extends ContentType>(
  slug: string,
  contentType: T,
  contentDir: string
): Promise<Extract<AnyContent, { category: T }> | null> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  try {
    // Try multiple file extensions
    const possibleFiles = [`${slug}.md`, `${slug}.mdx`];
    
    for (const fileName of possibleFiles) {
      const filePath = path.join(contentDir, fileName);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const result = await processMarkdownWithValidation(filePath, content, contentType);
        
        if (result.success && result.content) {
          return result.content as Extract<AnyContent, { category: T }>;
        }
      } catch {
        // File doesn't exist, continue to next
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error loading content ${slug}:`, error);
    return null;
  }
}

/**
 * Example: Content migration helper with validation
 */
export async function migrateContentWithValidation(
  oldContent: Record<string, unknown>,
  targetType: ContentType
): Promise<{
  success: boolean;
  migratedContent?: AnyContent;
  migrationNotes: string[];
  errors?: string[];
}> {
  const migrationNotes: string[] = [];
  const migratedContent: Record<string, unknown> = { ...oldContent };

  try {
    // Migrate common fields
    if (!migratedContent.category) {
      migratedContent.category = targetType;
      migrationNotes.push(`Added category: ${targetType}`);
    }

    // Generate slug if missing
    if (!migratedContent.slug && migratedContent.title) {
      migratedContent.slug = String(migratedContent.title)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      migrationNotes.push('Generated slug from title');
    }

    // Convert date strings to Date objects
    if (migratedContent.date && !migratedContent.publishedAt) {
      migratedContent.publishedAt = new Date(migratedContent.date);
      migrationNotes.push('Migrated date to publishedAt');
    }

    // Ensure required fields have defaults
    if (!migratedContent.tags) {
      migratedContent.tags = [];
      migrationNotes.push('Added empty tags array');
    }

    if (!migratedContent.author) {
      migratedContent.author = 'Unknown Author';
      migrationNotes.push('Added default author');
    }

    if (!migratedContent.readingTime) {
      migratedContent.readingTime = '5 min read';
      migrationNotes.push('Added default reading time');
    }

    // Validate migrated content
    const validationResult = validateContentByType(migratedContent, targetType);
    
    if (!validationResult.valid) {
      return {
        success: false,
        migrationNotes,
        errors: [
          'Migration validation failed:',
          generateErrorSummary(validationResult.errors),
        ],
      };
    }

    return {
      success: true,
      migratedContent: validationResult.data!,
      migrationNotes,
    };

  } catch (error) {
    return {
      success: false,
      migrationNotes,
      errors: [`Migration error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Example: Development helper to check content health
 */
export async function checkContentHealth(contentDirs: Record<ContentType, string>) {
  console.log('🔍 Checking content health across all types...\n');
  
  const results: Record<string, any> = {};
  
  for (const [contentType, dir] of Object.entries(contentDirs)) {
    try {
      const result = await validateContentDirectory(dir, contentType as ContentType);
      results[contentType] = result;
      
      console.log(`📁 ${contentType.toUpperCase()}`);
      console.log(`  ✅ Valid: ${result.validFiles}/${result.totalFiles}`);
      
      if (result.invalidFiles > 0) {
        console.log(`  ❌ Invalid: ${result.invalidFiles}`);
        result.errors.forEach(({ file, errors }) => {
          console.log(`    🔸 ${file}:`);
          errors.forEach(error => console.log(`      ${error}`));
        });
      }
      
      console.log('');
    } catch (error) {
      console.error(`❌ Failed to check ${contentType}: ${error}`);
    }
  }
  
  // Summary
  const totalValid = Object.values(results).reduce((sum: number, r: any) => sum + (r.validFiles || 0), 0);
  const totalInvalid = Object.values(results).reduce((sum: number, r: any) => sum + (r.invalidFiles || 0), 0);
  const totalFiles = totalValid + totalInvalid;
  
  console.log(`🏁 SUMMARY: ${totalValid}/${totalFiles} files are valid (${Math.round(totalValid/totalFiles*100)}%)`);
  
  return results;
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Validate a single file
 * const result = await processMarkdownWithValidation(
 *   '/path/to/blog-post.md',
 *   fileContent,
 *   'blog'
 * );
 * 
 * if (result.success) {
 *   console.log('Valid content:', result.content);
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * 
 * // Check all content health
 * await checkContentHealth({
 *   blog: '/path/to/blog',
 *   guide: '/path/to/guides',
 *   hub: '/path/to/hubs',
 *   spoke: '/path/to/spokes',
 *   documentation: '/path/to/docs',
 *   faq: '/path/to/faq',
 * });
 * 
 * // Type-safe content loading
 * const blogPost = await getValidatedContent('my-post', 'blog', '/path/to/blog');
 * if (blogPost) {
 *   // TypeScript knows this is a BlogPost
 *   console.log(blogPost.featured); // Type-safe access to blog-specific fields
 * }
 * ```
 */