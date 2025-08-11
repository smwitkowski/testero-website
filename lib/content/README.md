# Content Validation System

This directory contains the comprehensive content validation system for Testero, providing type-safe content operations with runtime validation.

## Files Overview

- **`types.ts`** - TypeScript interfaces for all content types
- **`schemas.ts`** - Zod validation schemas with detailed error messages  
- **`validators.ts`** - High-level validation utilities and helpers
- **`example-integration.ts`** - Integration examples and best practices

## Content Types

The system supports six content types:

- **Blog Posts** (`blog`) - Standard blog articles with optional featured status
- **Hub Content** (`hub`) - Pillar pages that connect related topics
- **Spoke Content** (`spoke`) - Detailed content that links to hub pages
- **Guides** (`guide`) - Step-by-step tutorials with difficulty levels
- **Documentation** (`documentation`) - Technical reference material
- **FAQ** (`faq`) - Question and answer pairs

## Quick Start

### Basic Validation

```typescript
import { validateContent } from './validators';

const blogPost = {
  category: 'blog',
  slug: 'my-first-post',
  title: 'My First Blog Post',
  description: 'A comprehensive guide to getting started with our platform.',
  publishedAt: new Date('2024-01-01'),
  tags: ['tutorial', 'beginner'],
  author: 'John Doe',
  readingTime: '5 min read',
};

const result = validateContent(blogPost);
if (result.valid) {
  console.log('✅ Valid content:', result.data);
} else {
  console.error('❌ Validation errors:', result.errors);
}
```

### Type-Specific Validation

```typescript
import { validateBlogPost, validateGuideContent } from './validators';

// Validate specific content types
const blogResult = validateBlogPost(blogPostData);
const guideResult = validateGuideContent(guideData);
```

### Batch Validation

```typescript
import { validateContentBatch } from './validators';

const items = [blogPost1, guide1, hubContent1];
const batchResult = validateContentBatch(items);

console.log(`${batchResult.valid}/${batchResult.valid + batchResult.invalid} files are valid`);
```

## Content Structure

### Required Fields (All Types)

```typescript
{
  title: string;           // 5-100 characters
  description: string;     // 20-200 characters  
  publishedAt: Date;       // Publication date
  tags: string[];          // 1-10 tags
  author: string;          // 2-50 characters
  readingTime: string;     // Format: "5 min read"
  category: ContentType;   // Content type identifier
  slug: string;           // URL-safe slug (lowercase, hyphens only)
}
```

### Optional Fields

```typescript
{
  updatedAt?: Date;        // Last modification date
  seo?: {                  // SEO overrides
    metaTitle?: string;    // 10-60 characters
    metaDescription?: string; // 50-160 characters
    canonicalUrl?: string; // Valid URL
    ogImage?: string;      // Valid URL
    twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  };
}
```

### Type-Specific Fields

#### Blog Posts
```typescript
{
  featured?: boolean;      // Whether post is featured
  excerpt?: string;        // 50-300 character excerpt
  blogCategory?: string;   // Blog-specific category
}
```

#### Guides  
```typescript
{
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  completionTime?: string;    // Format: "30 minutes" or "2 hours"
  prerequisites?: string[];   // Up to 10 prerequisites
  objectives?: string[];      // 1-15 learning objectives
}
```

#### Hub/Spoke Content
```typescript
{
  type: 'hub' | 'spoke';     // Legacy type field
  coverImage?: string;       // Valid URL
  lastModified?: string;     // Legacy support
  date: string;             // Legacy support
  
  // Spoke-specific
  hubSlug?: string;         // Parent hub slug
  spokeOrder?: number;      // Order within hub (0+)
}
```

#### Documentation
```typescript
{
  section?: string;         // Documentation section
  apiVersion?: string;      // Format: "v1.2.3" or "1.2.3-beta"
  deprecated?: boolean;     // Deprecation status
}
```

#### FAQ
```typescript
{
  question: string;         // 10-200 characters
  answer: string;          // 20-2000 characters
  faqCategory?: string;    // FAQ grouping
  priority?: number;       // 0-100 priority score
}
```

## Validation CLI

Run content validation from the command line:

```bash
# Validate all content
npm run validate:content

# Validate specific type
npm run validate:content -- --type blog

# Show detailed errors  
npm run validate:content -- --verbose

# Show help
npm run validate:content -- --help
```

## Integration Examples

### Processing Markdown Files

```typescript
import { processMarkdownWithValidation } from './example-integration';

const result = await processMarkdownWithValidation(
  '/path/to/blog-post.md',
  fileContent,
  'blog'
);

if (result.success) {
  // Use validated content and HTML
  const { content, html } = result;
} else {
  // Handle validation errors
  console.error(result.errors);
}
```

### Directory Validation

```typescript
import { validateContentDirectory } from './example-integration';

const result = await validateContentDirectory('/content/blog', 'blog');
console.log(`${result.validFiles}/${result.totalFiles} files are valid`);
```

### Type-Safe Content Loading

```typescript
import { getValidatedContent } from './example-integration';

// TypeScript knows this is a BlogPost
const blogPost = await getValidatedContent('my-post', 'blog', '/content/blog');
if (blogPost) {
  console.log(blogPost.featured); // Type-safe access
}
```

## Error Handling

The validation system provides detailed error messages:

```typescript
{
  field: "title",
  message: "Title must be at least 5 characters", 
  code: "too_small",
  value: "Hi"
}
```

Use `generateErrorSummary()` to create user-friendly error reports:

```typescript
import { generateErrorSummary } from './validators';

if (!result.valid) {
  console.log(generateErrorSummary(result.errors));
  // Output: "Found 2 validation errors:
  //          title: Title must be at least 5 characters
  //          tags: At least one tag is required"
}
```

## Best Practices

### 1. Validate Early
Always validate content immediately after parsing frontmatter:

```typescript
const { data: frontmatter } = matter(content);
const result = validateContent(frontmatter);
if (!result.valid) {
  throw new Error(generateErrorSummary(result.errors));
}
```

### 2. Use Type-Specific Validators
When you know the expected content type:

```typescript
// Better
const result = validateBlogPost(data);

// Avoid  
const result = validateContent(data);
```

### 3. Handle Date Conversion
Convert date strings before validation:

```typescript
if (typeof frontmatter.publishedAt === 'string') {
  frontmatter.publishedAt = new Date(frontmatter.publishedAt);
}
```

### 4. Provide Helpful Defaults
Set sensible defaults for optional fields:

```typescript
frontmatter.tags = frontmatter.tags || [];
frontmatter.author = frontmatter.author || 'Unknown Author';
```

### 5. Use Batch Validation for Performance
When processing multiple files:

```typescript
const results = validateContentBatch(allContent);
// Process valid items
results.validItems.forEach(item => processValidContent(item));
```

## Migration Guide

### From Legacy System
Use the migration helper to convert old content:

```typescript
import { migrateContentWithValidation } from './example-integration';

const result = await migrateContentWithValidation(oldContent, 'blog');
if (result.success) {
  console.log('Migration notes:', result.migrationNotes);
  // Use result.migratedContent
}
```

### Adding New Content Types
1. Add interface to `types.ts`
2. Create Zod schema in `schemas.ts`  
3. Add validator function in `validators.ts`
4. Update discriminated union types
5. Add to CLI validation script

## Testing

Run the validation tests:

```bash
npm test -- lib/content/__tests__/validation.test.ts
```

The test suite covers:
- All content type validation
- Error message quality
- Utility functions
- Edge cases and error conditions
- SEO field validation
- Slug format validation

## IDE Support

The system exports JSON schemas for IDE autocomplete. Configure your editor to use these schemas for `.md` and `.mdx` frontmatter validation.

## Performance

- Validation is fast thanks to Zod's optimized parsing
- Use batch validation for processing multiple files
- Cache validation results when appropriate
- Consider lazy validation for non-critical paths