import React from 'react';
import Link from 'next/link';
import { BlogPost } from '@/lib/content/blog-loader';
import { BlogTagPill } from './BlogTagPill';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type BlogPostCardProps = {
  post: BlogPost;
  variant?: 'featured' | 'compact' | 'grid';
  className?: string;
};

// Helper to create slug from tag/category
function createSlug(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

// Helper to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function BlogPostCard({ post, variant = 'grid', className }: BlogPostCardProps) {
  const { meta } = post;
  const primaryTag = meta.tags?.[0] || meta.category;
  const tagSlug = primaryTag ? createSlug(primaryTag) : '';

  if (variant === 'featured') {
    // Large hero-like card (no image, but styled like template's BlogLayoutOne)
    return (
      <div className={cn('group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 p-8 md:p-12 text-white', className)}>
        <div className="relative z-10">
          {primaryTag && (
            <BlogTagPill
              name={primaryTag}
              link={tagSlug ? `/blog/tags/${tagSlug}` : undefined}
              className="mb-6 bg-white/20 text-white border-white/30 hover:bg-white/30"
            />
          )}
          <Link href={`/blog/${meta.slug}`} className="block mt-6 group-hover:no-underline">
            <h2 className="font-bold text-2xl sm:text-3xl md:text-4xl mb-4 group-hover:text-blue-100 transition-colors">
              <span className="bg-gradient-to-r from-white to-white bg-[length:0px_6px] group-hover:bg-[length:100%_6px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500">
                {meta.title}
              </span>
            </h2>
            <p className="text-lg md:text-xl text-white/90 mb-6 leading-relaxed line-clamp-3">
              {meta.description}
            </p>
            <div className="inline-flex items-center space-x-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors">
              <span>Read Article</span>
              <span>→</span>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    // Compact row card (like template's BlogLayoutTwo, no image)
    return (
      <div className={cn('group grid grid-cols-12 gap-4 items-center', className)}>
        <div className="col-span-12 lg:col-span-8 w-full">
          {primaryTag && (
            <span className="inline-block w-full uppercase text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm mb-1">
              {primaryTag}
            </span>
          )}
          <Link href={`/blog/${meta.slug}`} className="inline-block my-1 group-hover:no-underline">
            <h2 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white">
              <span className="bg-gradient-to-r from-blue-600/50 to-blue-600/50 dark:from-blue-400/50 dark:to-blue-400/50 bg-[length:0px_6px] group-hover:bg-[length:100%_6px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500">
                {meta.title}
              </span>
            </h2>
          </Link>
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mt-2">
            <time className="capitalize font-semibold">
              {formatDate(meta.publishedAt)}
            </time>
            {meta.readingTime && (
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{meta.readingTime}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default grid card (like template's BlogLayoutThree, no image)
  return (
    <div className={cn('group flex flex-col text-gray-900 dark:text-white', className)}>
      <div className="flex flex-col w-full">
        {primaryTag && (
          <span className="uppercase text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm mb-2">
            {primaryTag}
          </span>
        )}
        <Link href={`/blog/${meta.slug}`} className="inline-block my-1 group-hover:no-underline">
          <h2 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white">
            <span className="bg-gradient-to-r from-blue-600/50 to-blue-600/50 dark:from-blue-400/50 dark:to-blue-400/50 bg-[length:0px_6px] group-hover:bg-[length:100%_6px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500">
              {meta.title}
            </span>
          </h2>
        </Link>
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mt-2">
          <time className="capitalize font-semibold">
            {formatDate(meta.publishedAt)}
          </time>
          {meta.readingTime && (
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{meta.readingTime}</span>
            </span>
          )}
        </div>
        <p className="text-gray-700 dark:text-gray-300 mt-3 line-clamp-2 text-sm">
          {meta.description}
        </p>
      </div>
    </div>
  );
}
