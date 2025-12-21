import React from 'react';
import { BlogTagPill } from './BlogTagPill';
import { cn } from '@/lib/utils';

type BlogCategoriesProps = {
  categories: string[];
  currentSlug?: string;
  basePath?: string;
  className?: string;
};

// Helper to create slug from category/tag
function createSlug(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export function BlogCategories({ 
  categories, 
  currentSlug, 
  basePath = '/blog/tags',
  className 
}: BlogCategoriesProps) {
  return (
    <div className={cn(
      'px-0 md:px-10 mt-10 border-t-2 border-b-2 border-solid border-gray-900 dark:border-gray-100 py-4 flex items-start flex-wrap font-medium mx-5 md:mx-10',
      className
    )}>
      {categories.map((cat) => {
        const slug = createSlug(cat);
        const isActive = currentSlug === slug;
        
        return (
          <BlogTagPill
            key={cat}
            name={cat}
            link={`${basePath}/${slug}`}
            active={isActive}
            className="m-2"
          />
        );
      })}
    </div>
  );
}
