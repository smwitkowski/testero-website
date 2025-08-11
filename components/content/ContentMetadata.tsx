'use client';

import React from 'react';
import { Calendar, Clock, User, Edit, Tag } from 'lucide-react';
import { ContentMetadataProps } from './types';

/**
 * Unified ContentMetadata component for displaying author, date, reading time, and other content metadata
 * Consolidates scattered metadata display logic from various page files
 */
function ContentMetadata({
  author,
  publishedAt,
  updatedAt,
  readingTime,
  category,
  tags,
  variant = 'full',
  orientation = 'horizontal',
  className = '',
  show = {},
  dateFormat = {}
}: ContentMetadataProps) {
  // Default show options based on variant
  const defaultShow = {
    author: variant === 'full' || variant === 'minimal',
    date: true,
    readingTime: variant === 'full' || variant === 'compact',
    category: variant === 'full',
    tags: variant === 'full',
    lastModified: variant === 'full' && !!updatedAt
  };

  const showOptions = { ...defaultShow, ...show };

  // Format dates consistently
  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const { style = 'medium', locale = 'en-US' } = dateFormat;
    
    const optionsMap: Record<string, Intl.DateTimeFormatOptions> = {
      full: { year: 'numeric', month: 'long', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric' },
      medium: { year: 'numeric', month: 'short', day: 'numeric' },
      short: { month: '2-digit', day: '2-digit', year: '2-digit' }
    };
    const options = optionsMap[style];

    return dateObj.toLocaleDateString(locale, options);
  };

  // Format reading time consistently
  const formatReadingTime = (time: string | number | undefined): string => {
    if (!time) return '';
    
    if (typeof time === 'string') {
      return time;
    }
    
    return `${time} min read`;
  };

  // Check if we should show last modified
  const shouldShowLastModified = showOptions.lastModified && 
    updatedAt && 
    updatedAt !== publishedAt;

  const isVertical = orientation === 'vertical';
  const containerClass = isVertical 
    ? 'space-y-3' 
    : 'flex flex-wrap items-center gap-4 md:gap-6';

  const metadataItems = [];

  // Author
  if (showOptions.author && author) {
    metadataItems.push(
      <div key="author" className="flex items-center space-x-2 text-gray-600">
        <User className="w-4 h-4 flex-shrink-0" />
        <span className={`${variant === 'compact' ? 'text-sm' : ''} font-medium`}>
          {author}
        </span>
      </div>
    );
  }

  // Publication date
  if (showOptions.date && publishedAt) {
    metadataItems.push(
      <div key="date" className="flex items-center space-x-2 text-gray-600">
        <Calendar className="w-4 h-4 flex-shrink-0" />
        <time 
          dateTime={typeof publishedAt === 'string' ? publishedAt : publishedAt.toISOString()}
          className={variant === 'compact' ? 'text-sm' : ''}
        >
          {formatDate(publishedAt)}
        </time>
      </div>
    );
  }

  // Last modified date
  if (shouldShowLastModified) {
    metadataItems.push(
      <div key="updated" className="flex items-center space-x-2 text-gray-500 text-sm">
        <Edit className="w-4 h-4 flex-shrink-0" />
        <span>
          Updated {formatDate(updatedAt!)}
        </span>
      </div>
    );
  }

  // Reading time
  if (showOptions.readingTime && readingTime) {
    metadataItems.push(
      <div key="reading-time" className="flex items-center space-x-2 text-gray-600">
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span className={variant === 'compact' ? 'text-sm' : ''}>
          {formatReadingTime(readingTime)}
        </span>
      </div>
    );
  }

  return (
    <div className={`content-metadata ${className}`}>
      {/* Main metadata */}
      <div className={containerClass}>
        {metadataItems}
      </div>

      {/* Category */}
      {showOptions.category && category && (
        <div className={`${isVertical ? 'mt-3' : 'mt-4'}`}>
          <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            {category.replace('-', ' ').toUpperCase()}
          </div>
        </div>
      )}

      {/* Tags */}
      {showOptions.tags && tags && tags.length > 0 && (
        <div className={`${isVertical ? 'mt-3' : 'mt-4'}`}>
          <div className="flex items-start space-x-2">
            <Tag className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Preset variants for common use cases
 */
export const ContentMetadataVariants = {
  // Full metadata with all options
  Full: (props: Omit<ContentMetadataProps, 'variant'>) => (
    <ContentMetadata {...props} variant="full" />
  ),

  // Minimal metadata for compact displays
  Minimal: (props: Omit<ContentMetadataProps, 'variant'>) => (
    <ContentMetadata {...props} variant="minimal" />
  ),

  // Compact metadata for cards/previews
  Compact: (props: Omit<ContentMetadataProps, 'variant'>) => (
    <ContentMetadata {...props} variant="compact" />
  ),

  // Blog post header metadata
  BlogHeader: (props: Omit<ContentMetadataProps, 'variant' | 'show'>) => (
    <ContentMetadata 
      {...props} 
      variant="full"
      show={{ author: true, date: true, readingTime: true, category: true, tags: false }}
    />
  ),

  // Article byline metadata
  ArticleByline: (props: Omit<ContentMetadataProps, 'variant' | 'show' | 'orientation'>) => (
    <ContentMetadata 
      {...props} 
      variant="minimal"
      orientation="horizontal"
      show={{ author: true, date: true, readingTime: true, category: false, tags: false }}
      className="text-sm text-gray-500 border-t pt-4"
    />
  ),

  // Content preview metadata (for cards)
  Preview: (props: Omit<ContentMetadataProps, 'variant' | 'show'>) => (
    <ContentMetadata 
      {...props} 
      variant="compact"
      show={{ author: false, date: true, readingTime: true, category: false, tags: false }}
    />
  )
};

// Export both default and named
export default ContentMetadata;
export { ContentMetadata };