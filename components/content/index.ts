/**
 * Unified content component exports
 * 
 * This file provides a single source for importing all content components
 * and their related types, following the extraction and consolidation
 * from Linear issue TES-332.
 */

// Component exports
export { default as TableOfContents } from './TableOfContents';
export { default as SocialShare } from './SocialShare';
export { default as RecommendedContent, RelatedContent } from './RecommendedContent';
export { default as ContentMetadata, ContentMetadataVariants } from './ContentMetadata';
export { default as ContentNavigation } from './ContentNavigation';

// Type exports
export type {
  TableOfContentsProps,
  SocialShareProps,
  RelatedContentProps,
  ContentMetadataProps,
  Heading,
  ContentItem,
  SocialPlatform,
  BaseComponentProps,
  LoadingProps,
  ErrorProps,
  A11yProps
} from './types';

// Re-export existing ContentNavigation for completeness
// (This was already unified, just ensuring it's included)