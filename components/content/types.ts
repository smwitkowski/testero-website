/**
 * Unified TypeScript interfaces for content components
 */

import { ReactNode } from 'react';

/**
 * Table of Contents component props
 */
export interface TableOfContentsProps {
  /** ID of the content container to scan for headings */
  contentId?: string;
  /** HTML content to parse for headings */
  content?: string;
  /** Additional CSS classes */
  className?: string;
  /** Heading levels to include (default: [2, 3, 4]) */
  headingLevels?: number[];
  /** Show heading numbers */
  showNumbers?: boolean;
  /** Sticky positioning */
  sticky?: boolean;
  /** Intersection observer options */
  observerOptions?: IntersectionObserverInit;
}

/**
 * Social Share component props
 */
export interface SocialShareProps {
  /** Content title to share */
  title: string;
  /** URL to share */
  url: string;
  /** Content description */
  description?: string;
  /** Additional CSS classes */
  className?: string;
  /** Display variant */
  variant?: 'compact' | 'detailed' | 'minimal';
  /** Custom sharing platforms */
  platforms?: ('twitter' | 'linkedin' | 'facebook' | 'copy')[];
  /** Show sharing stats */
  showStats?: boolean;
}

/**
 * Related Content component props
 */
export interface RelatedContentProps {
  /** Current content slug to exclude from recommendations */
  currentSlug: string;
  /** Current content type */
  contentType: string;
  /** Content category for filtering */
  category?: string;
  /** Section title */
  title?: string;
  /** Number of items to show */
  limit?: number;
  /** Display layout */
  layout?: 'grid' | 'list' | 'carousel';
  /** Show cover images */
  showImages?: boolean;
  /** Show metadata (date, reading time) */
  showMetadata?: boolean;
}

/**
 * Content Metadata component props
 */
export interface ContentMetadataProps {
  /** Author name */
  author?: string;
  /** Publication date */
  publishedAt: Date | string;
  /** Last update date */
  updatedAt?: Date | string;
  /** Estimated reading time */
  readingTime?: string | number;
  /** Content category */
  category?: string;
  /** Content tags */
  tags?: string[];
  /** Display variant */
  variant?: 'full' | 'minimal' | 'compact';
  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Additional CSS classes */
  className?: string;
  /** Show specific fields */
  show?: {
    author?: boolean;
    date?: boolean;
    readingTime?: boolean;
    category?: boolean;
    tags?: boolean;
    lastModified?: boolean;
  };
  /** Date format options */
  dateFormat?: {
    style?: 'full' | 'long' | 'medium' | 'short';
    locale?: string;
  };
}

/**
 * Heading structure for Table of Contents
 */
export interface Heading {
  id: string;
  text: string;
  level: number;
  children?: Heading[];
}

/**
 * Content item structure for Related Content
 */
export interface ContentItem {
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
  canonicalUrl?: string;
}

/**
 * Social sharing platform configuration
 */
export interface SocialPlatform {
  name: string;
  icon: ReactNode;
  url: (params: { url: string; title: string; description?: string }) => string;
  color: string;
  label: string;
}

/**
 * Common component props
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Loading states for async components
 */
export interface LoadingProps {
  /** Loading state */
  loading?: boolean;
  /** Loading skeleton count */
  skeletonCount?: number;
  /** Loading message */
  loadingMessage?: string;
}

/**
 * Error states for components
 */
export interface ErrorProps {
  /** Error state */
  error?: Error | string | null;
  /** Error message */
  errorMessage?: string;
  /** Retry function */
  onRetry?: () => void;
}

/**
 * Accessibility props
 */
export interface A11yProps {
  /** ARIA label */
  'aria-label'?: string;
  /** ARIA described by */
  'aria-describedby'?: string;
  /** ARIA expanded */
  'aria-expanded'?: boolean;
  /** Role */
  role?: string;
}