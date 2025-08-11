# Content Component API Documentation

## Overview

The Testero content system provides a suite of unified React components for rendering content with consistent styling, behavior, and accessibility features. All components are built with TypeScript, include comprehensive prop validation, and follow modern React patterns.

## Component Hierarchy

```
content/
├── TableOfContents      # Auto-generated navigation from headings
├── SocialShare          # Multi-platform content sharing
├── ContentMetadata      # Author, date, reading time display
├── RecommendedContent   # Related content suggestions
├── ContentNavigation    # Previous/next navigation
└── types.ts            # Shared TypeScript interfaces
```

## Core Components

### TableOfContents

Automatically generates navigation from content headings with active section highlighting and smooth scrolling.

#### Props Interface

```typescript
interface TableOfContentsProps {
  contentId?: string;                    // ID of content container to scan
  content?: string;                      // HTML content to parse for headings
  className?: string;                    // Additional CSS classes
  headingLevels?: number[];             // Heading levels to include [2, 3, 4]
  showNumbers?: boolean;                 // Show heading numbers
  sticky?: boolean;                      // Enable sticky positioning
  observerOptions?: IntersectionObserverInit; // Intersection observer config
}
```

#### Usage Examples

##### Basic Usage
```tsx
import { TableOfContents } from '@/components/content';

export default function BlogPost({ content }) {
  return (
    <div className="flex">
      <aside className="w-64">
        <TableOfContents contentId="blog-content" />
      </aside>
      <article id="blog-content">
        {/* Your content here */}
      </article>
    </div>
  );
}
```

##### Advanced Configuration
```tsx
<TableOfContents
  contentId="article-content"
  headingLevels={[2, 3]}
  showNumbers={true}
  sticky={true}
  className="bg-gray-50 p-4 rounded-lg"
  observerOptions={{
    rootMargin: '0px 0px -60% 0px',
    threshold: 0.1
  }}
/>
```

##### Content-Based Parsing
```tsx
// When you have HTML content instead of DOM element
<TableOfContents
  content={processedHTMLContent}
  headingLevels={[2, 3, 4]}
  showNumbers={false}
/>
```

#### Features

- **Automatic ID Generation**: Creates unique IDs for headings without them
- **Active Section Highlighting**: Uses Intersection Observer for smooth highlighting
- **Smooth Scrolling**: Built-in smooth scroll behavior
- **Responsive Design**: Adapts to mobile and desktop layouts
- **Accessibility**: Full ARIA labels and semantic HTML
- **Performance**: Efficient DOM queries and observer management

#### Styling Classes

```css
.table-of-contents {
  /* Base container styles */
}

.table-of-contents ul {
  /* List styling */
}

.table-of-contents a {
  /* Link styling with hover states */
}

.table-of-contents a[aria-current="true"] {
  /* Active link highlighting */
}
```

---

### SocialShare

Multi-platform sharing component with customizable platforms and display variants.

#### Props Interface

```typescript
interface SocialShareProps {
  title: string;                        // Content title to share
  url: string;                          // URL to share
  description?: string;                 // Content description  
  className?: string;                   // Additional CSS classes
  variant?: 'compact' | 'detailed' | 'minimal'; // Display style
  platforms?: ('twitter' | 'linkedin' | 'facebook' | 'copy')[]; // Sharing platforms
  showStats?: boolean;                  // Show sharing statistics
}
```

#### Usage Examples

##### Compact Header Sharing
```tsx
import { SocialShare } from '@/components/content';

<SocialShare
  title="PMLE Certification Guide 2025"
  url="/blog/pmle-certification-guide-2025"
  variant="compact"
  platforms={['twitter', 'linkedin', 'copy']}
  className="mb-4"
/>
```

##### Detailed Footer Sharing
```tsx
<SocialShare
  title={post.title}
  url={`/blog/${post.slug}`}
  description={post.description}
  variant="detailed"
  platforms={['twitter', 'linkedin', 'facebook', 'copy']}
  className="border-t pt-6 mt-8"
/>
```

##### Minimal Sharing
```tsx
<SocialShare
  title="Google Cloud Certification Guide"
  url="/hub/google-cloud-certification-guide"
  variant="minimal"
  platforms={['copy']}
/>
```

#### Platform Configuration

The component automatically handles URL formatting for different content types:
- **Blog posts**: `/blog/slug` → Direct URL
- **Hub content**: `/hub/slug` → `/content/hub/slug`
- **Spoke content**: `/spoke/slug` → `/content/spoke/slug`

#### Features

- **URL Auto-formatting**: Handles different content type URL structures
- **Clipboard API**: Modern clipboard API with legacy fallback
- **Visual Feedback**: Copy confirmation with checkmark animation
- **Mobile Optimized**: Touch-friendly buttons and proper spacing
- **Analytics Ready**: Trackable sharing events
- **Accessibility**: Full ARIA labels and keyboard navigation

#### Platform URLs

```typescript
const shareUrls = {
  twitter: 'https://twitter.com/intent/tweet?text={title}&url={url}',
  linkedin: 'https://www.linkedin.com/shareArticle?mini=true&url={url}&title={title}&summary={description}',
  facebook: 'https://www.facebook.com/sharer/sharer.php?u={url}'
};
```

---

### ContentMetadata

Unified metadata display component for author, publication date, reading time, categories, and tags.

#### Props Interface

```typescript
interface ContentMetadataProps {
  author?: string;                      // Author name
  publishedAt: Date | string;           // Publication date
  updatedAt?: Date | string;           // Last update date
  readingTime?: string | number;        // Reading time estimate
  category?: string;                    // Content category
  tags?: string[];                      // Content tags array
  variant?: 'full' | 'minimal' | 'compact'; // Display variant
  orientation?: 'horizontal' | 'vertical';   // Layout orientation
  className?: string;                   // Additional CSS classes
  show?: {                             // Selective field display
    author?: boolean;
    date?: boolean;
    readingTime?: boolean;
    category?: boolean;
    tags?: boolean;
    lastModified?: boolean;
  };
  dateFormat?: {                       // Date formatting options
    style?: 'full' | 'long' | 'medium' | 'short';
    locale?: string;
  };
}
```

#### Usage Examples

##### Blog Post Header
```tsx
import { ContentMetadata } from '@/components/content';

<ContentMetadata
  author="Testero Team"
  publishedAt={new Date('2025-01-15')}
  updatedAt={new Date('2025-01-20')}
  readingTime="8 min read"
  category="certification-guides"
  tags={['PMLE', 'Google Cloud', 'Machine Learning']}
  variant="full"
  className="mb-6"
/>
```

##### Compact Card Metadata
```tsx
<ContentMetadata
  publishedAt={post.publishedAt}
  readingTime={post.readingTime}
  variant="compact"
  show={{ date: true, readingTime: true, author: false }}
/>
```

##### Custom Date Formatting
```tsx
<ContentMetadata
  author="John Doe"
  publishedAt="2025-01-15"
  variant="minimal"
  dateFormat={{ style: 'long', locale: 'en-US' }}
/>
```

#### Preset Variants

The component includes preset configurations for common use cases:

```tsx
// Full metadata display
<ContentMetadataVariants.Full
  author="Testero Team"
  publishedAt={publishDate}
  readingTime="5 min read"
  category="guides"
  tags={['tutorial', 'beginner']}
/>

// Blog post header
<ContentMetadataVariants.BlogHeader
  author="Author Name"
  publishedAt={publishDate}
  readingTime="8 min read"
  category="certification-guides"
/>

// Article byline
<ContentMetadataVariants.ArticleByline
  author="Author Name"
  publishedAt={publishDate}
  readingTime="5 min read"
/>

// Content preview (for cards)
<ContentMetadataVariants.Preview
  publishedAt={publishDate}
  readingTime="3 min read"
/>
```

#### Features

- **Flexible Display Options**: Show/hide individual metadata fields
- **Internationalization**: Configurable date formatting and locales
- **Reading Time Formatting**: Handles both string and numeric reading times
- **Smart Last Modified**: Only shows when different from publish date
- **Responsive Layout**: Horizontal/vertical orientation options
- **Icon Integration**: Lucide React icons for visual clarity

---

### RecommendedContent

Intelligent content recommendation component with multiple layout options.

#### Props Interface

```typescript
interface RelatedContentProps {
  currentSlug: string;                  // Current content slug (to exclude)
  contentType: string;                  // Content type for filtering
  category?: string;                    // Category for filtering
  title?: string;                       // Section title
  limit?: number;                       // Number of items to show
  layout?: 'grid' | 'list' | 'carousel'; // Display layout
  showImages?: boolean;                 // Show cover images
  showMetadata?: boolean;               // Show metadata (date, reading time)
}
```

#### Usage Examples

##### Basic Related Posts
```tsx
import { RecommendedContent } from '@/components/content';

<RecommendedContent
  currentSlug="pmle-certification-guide-2025"
  contentType="blog"
  category="certification-guides"
  title="Related Articles"
  limit={3}
  layout="grid"
  showImages={true}
  showMetadata={true}
/>
```

##### Sidebar Recommendations
```tsx
<RecommendedContent
  currentSlug={post.slug}
  contentType="blog"
  title="You Might Also Like"
  limit={4}
  layout="list"
  showImages={false}
  showMetadata={true}
  className="bg-gray-50 p-4 rounded-lg"
/>
```

##### Carousel Layout
```tsx
<RecommendedContent
  currentSlug={hubContent.slug}
  contentType="spoke"
  category={hubContent.category}
  title="Related Guides"
  limit={6}
  layout="carousel"
  showImages={true}
/>
```

#### Features

- **Smart Filtering**: Excludes current content and filters by type/category
- **Multiple Layouts**: Grid, list, and carousel display options
- **Content Intelligence**: Recommends based on categories and tags
- **Performance Optimized**: Efficient content loading and caching
- **Mobile Responsive**: Adapts layouts for different screen sizes

---

### ContentNavigation

Previous/next navigation component for content series and related articles.

#### Usage Examples

```tsx
import { ContentNavigation } from '@/components/content';

<ContentNavigation
  previous={{
    title: "Setting Up Your Environment",
    slug: "setup-environment",
    type: "guide"
  }}
  next={{
    title: "Advanced Configuration",
    slug: "advanced-configuration", 
    type: "guide"
  }}
  className="border-t border-b py-6 my-8"
/>
```

## Common Usage Patterns

### Blog Post Layout

```tsx
import { 
  TableOfContents, 
  SocialShare, 
  ContentMetadata, 
  RecommendedContent 
} from '@/components/content';

export default function BlogPost({ post, content }) {
  return (
    <article className="max-w-4xl mx-auto px-4">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <p className="text-xl text-gray-600 mb-6">{post.description}</p>
        
        <ContentMetadata
          author={post.author}
          publishedAt={post.publishedAt}
          readingTime={post.readingTime}
          category={post.category}
          tags={post.tags}
          variant="full"
          className="mb-6 pb-6 border-b"
        />
        
        <SocialShare
          title={post.title}
          url={`/blog/${post.slug}`}
          description={post.description}
          variant="compact"
          platforms={['twitter', 'linkedin', 'copy']}
        />
      </header>

      {/* Content with ToC */}
      <div className="flex gap-8">
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <TableOfContents
            contentId="blog-content"
            sticky={true}
            showNumbers={true}
          />
        </aside>
        
        <div className="flex-1">
          <div 
            id="blog-content"
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12">
        <SocialShare
          title={post.title}
          url={`/blog/${post.slug}`}
          description={post.description}
          variant="detailed"
          platforms={['twitter', 'linkedin', 'facebook', 'copy']}
          className="mb-8 pb-8 border-b"
        />
        
        <RecommendedContent
          currentSlug={post.slug}
          contentType="blog"
          category={post.category}
          title="Related Articles"
          limit={3}
          layout="grid"
          showImages={true}
          showMetadata={true}
        />
      </footer>
    </article>
  );
}
```

### Hub/Spoke Content Layout

```tsx
export default function HubContent({ hubContent, spokes, content }) {
  return (
    <div className="max-w-6xl mx-auto px-4">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{hubContent.title}</h1>
        
        <ContentMetadataVariants.ArticleByline
          author={hubContent.author}
          publishedAt={hubContent.publishedAt}
          readingTime={hubContent.readingTime}
        />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div 
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
        
        <aside>
          <TableOfContents 
            contentId="hub-content"
            className="mb-8"
          />
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold mb-3">Related Guides</h3>
            {spokes.map(spoke => (
              <a 
                key={spoke.slug}
                href={`/spoke/${spoke.slug}`}
                className="block p-2 hover:bg-white rounded"
              >
                {spoke.title}
              </a>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
```

## TypeScript Integration

### Component Type Safety

All components are fully typed with strict TypeScript interfaces:

```typescript
import { TableOfContentsProps, SocialShareProps } from '@/components/content/types';

// Type-safe component usage
const TableOfContentsConfig: TableOfContentsProps = {
  contentId: 'main-content',
  headingLevels: [2, 3],
  showNumbers: true,
  sticky: true
};

// Generic content item type for recommendations
interface ContentItem {
  slug: string;
  title: string;
  description: string;
  type: string;
  publishedAt: Date | string;
  readingTime?: string | number;
  coverImage?: string;
  category?: string;
  tags?: string[];
  author?: string;
}
```

### Prop Validation

Components include runtime prop validation in development:

```typescript
// Example validation for required props
if (process.env.NODE_ENV === 'development') {
  if (!title || !url) {
    console.warn('SocialShare: title and url props are required');
  }
}
```

## Accessibility Features

### ARIA Support

All components include comprehensive ARIA attributes:

```tsx
// TableOfContents
<nav aria-label="Table of Contents">
  <ul role="list">
    <li role="listitem">
      <a 
        href="#heading-1"
        aria-current={activeId === 'heading-1' ? 'true' : 'false'}
      >
        Heading Text
      </a>
    </li>
  </ul>
</nav>

// SocialShare
<button
  onClick={shareToTwitter}
  aria-label="Share on Twitter"
  role="button"
>
  <Twitter className="w-4 h-4" />
  <span className="sr-only">Share on Twitter</span>
</button>

// ContentMetadata
<time 
  dateTime={publishedAt.toISOString()}
  aria-label={`Published on ${formatDate(publishedAt)}`}
>
  {formatDate(publishedAt)}
</time>
```

### Keyboard Navigation

Components support full keyboard navigation:

- **TableOfContents**: Arrow key navigation, Enter to activate links
- **SocialShare**: Tab navigation, Space/Enter to activate buttons  
- **RecommendedContent**: Focus management for carousel navigation

### Screen Reader Support

- Semantic HTML structure with proper headings hierarchy
- Descriptive alt text for images and icons
- Live regions for dynamic content updates
- Skip links for navigation efficiency

## Performance Optimization

### Bundle Size

Components are optimized for minimal bundle impact:

```typescript
// Tree-shaking friendly exports
export { TableOfContents } from './TableOfContents';
export { SocialShare } from './SocialShare';
export { ContentMetadata } from './ContentMetadata';

// Individual imports to reduce bundle size
import { TableOfContents } from '@/components/content/TableOfContents';
```

### Lazy Loading

Components support lazy loading for performance:

```tsx
import dynamic from 'next/dynamic';

// Lazy load table of contents for long articles
const TableOfContents = dynamic(
  () => import('@/components/content/TableOfContents'),
  { ssr: false }
);

// Lazy load recommendations below the fold
const RecommendedContent = dynamic(
  () => import('@/components/content/RecommendedContent'),
  { loading: () => <div>Loading recommendations...</div> }
);
```

### Intersection Observer

TableOfContents uses optimized Intersection Observer:

```typescript
const observerOptions = {
  rootMargin: '0px 0px -80% 0px', // Trigger when heading is in top 20%
  threshold: 0.1,                 // 10% visibility threshold
};
```

## Testing

### Component Testing

```tsx
import { render, screen } from '@testing-library/react';
import { TableOfContents } from '@/components/content';

describe('TableOfContents', () => {
  it('generates navigation from content headings', () => {
    const content = `
      <h2 id="section-1">Section 1</h2>
      <h3 id="subsection-1">Subsection 1</h3>
      <h2 id="section-2">Section 2</h2>
    `;
    
    render(<TableOfContents content={content} />);
    
    expect(screen.getByText('Section 1')).toBeInTheDocument();
    expect(screen.getByText('Subsection 1')).toBeInTheDocument();
    expect(screen.getByText('Section 2')).toBeInTheDocument();
  });
});
```

### Integration Testing

```tsx
describe('Content Page Integration', () => {
  it('renders all content components correctly', () => {
    const mockPost = {
      title: 'Test Post',
      slug: 'test-post',
      author: 'Test Author',
      publishedAt: new Date(),
      readingTime: '5 min read'
    };
    
    render(<BlogPost post={mockPost} />);
    
    expect(screen.getByText('Test Post')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('5 min read')).toBeInTheDocument();
  });
});
```

## Migration Guide

### From Legacy Components

If migrating from legacy component implementations:

```tsx
// Old individual metadata displays
// ❌ Before
<div>
  <span>{author}</span>
  <span>{formatDate(publishedAt)}</span>  
  <span>{readingTime}</span>
</div>

// ✅ After
<ContentMetadata
  author={author}
  publishedAt={publishedAt}
  readingTime={readingTime}
  variant="minimal"
/>
```

### Component Updates

When updating components, follow these patterns:

1. **Backward Compatibility**: Maintain existing prop interfaces
2. **Gradual Migration**: Use feature flags for new functionality
3. **Deprecation Warnings**: Add console warnings for deprecated props
4. **Type Safety**: Ensure TypeScript compatibility across versions

## Best Practices

### Component Composition

```tsx
// ✅ Good: Compose components for flexibility
<article>
  <ContentMetadata {...metadataProps} variant="full" />
  <div className="content">
    {children}
  </div>
  <SocialShare {...shareProps} variant="detailed" />
</article>

// ❌ Avoid: Monolithic components with too many responsibilities
<ArticleWithEverything {...allProps} />
```

### Performance Considerations

```tsx
// ✅ Good: Memoize expensive computations
const memoizedHeadings = useMemo(() => 
  extractHeadings(content), [content]
);

// ✅ Good: Lazy load heavy components
const TableOfContents = dynamic(() => import('./TableOfContents'));

// ❌ Avoid: Heavy computations in render
return (
  <div>
    {expensiveComputation(props)} // This runs on every render
  </div>
);
```

### Accessibility Best Practices

```tsx
// ✅ Good: Semantic HTML with ARIA
<nav aria-label="Table of Contents">
  <ol role="list">
    {headings.map(heading => (
      <li key={heading.id} role="listitem">
        <a href={`#${heading.id}`} aria-current={isActive}>
          {heading.text}
        </a>
      </li>
    ))}
  </ol>
</nav>

// ❌ Avoid: Generic divs without semantic meaning
<div className="toc">
  <div className="toc-item" onClick={scrollTo}>
    {heading.text}
  </div>
</div>
```

This component API documentation provides comprehensive coverage of all content components, their interfaces, usage patterns, and best practices for implementation in the Testero content system.