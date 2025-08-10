import React, { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAllContentByType, CONTENT_CONFIG, type UnifiedContent } from '@/lib/content/config';
import { RelatedContentProps } from './types';

// Server component to fetch and filter recommended content
async function getRecommendedContent({
  currentSlug,
  contentType,
  category,
  limit = 3
}: {
  currentSlug: string;
  contentType: string;
  category?: string;
  limit?: number;
}): Promise<UnifiedContent[]> {
  try {
    // Get content from the same type, or mix different types for variety
    const allContent: UnifiedContent[] = [];
    
    // Get content from same type first
    const validContentType = contentType as keyof typeof CONTENT_CONFIG;
    const sameTypeContent = await getAllContentByType(validContentType);
    allContent.push(...sameTypeContent);
    
    // If we need more content, get from other types
    if (allContent.length < limit + 1) { // +1 because we'll filter out current
      const otherTypes = ['blog', 'hub', 'spokes'].filter(type => type !== contentType);
      for (const type of otherTypes) {
        const otherContent = await getAllContentByType(type as keyof typeof CONTENT_CONFIG);
        allContent.push(...otherContent);
        if (allContent.length >= limit + 1) break;
      }
    }
    
    // Filter and prioritize content
    let filteredContent = allContent.filter(item => item.slug !== currentSlug);
    
    // Prioritize same category if available
    if (category) {
      const sameCategory = filteredContent.filter(item => item.meta.category === category);
      const otherCategory = filteredContent.filter(item => item.meta.category !== category);
      filteredContent = [...sameCategory, ...otherCategory];
    }
    
    return filteredContent.slice(0, limit);
  } catch (error) {
    console.error('Failed to fetch recommended content:', error);
    return [];
  }
}

function LoadingSkeleton({ limit, title }: { limit: number; title: string }) {
  return (
    <section className="mt-12 bg-gray-50 rounded-xl p-8">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
            <div className="h-40 bg-gray-200"></div>
            <div className="p-5">
              <div className="h-6 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

async function RecommendedContentInner({
  currentSlug,
  contentType,
  category,
  title = 'Recommended Resources',
  limit = 3,
  layout = 'grid',
  showImages = true,
  showMetadata = true
}: RelatedContentProps) {
  const content = await getRecommendedContent({
    currentSlug,
    contentType,
    category,
    limit
  });

  if (content.length === 0) return null;

  const containerClass = layout === 'list' 
    ? 'space-y-4' 
    : layout === 'carousel'
    ? 'flex overflow-x-auto space-x-6 pb-4'
    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
  
  return (
    <section className="mt-12 bg-gray-50 rounded-xl p-8">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className={containerClass}>
        {content.map((item) => (
          <div key={item.slug} className={`bg-white rounded-lg shadow-sm overflow-hidden ${layout === 'list' ? 'flex flex-row' : layout === 'carousel' ? 'flex-shrink-0 w-80' : ''} ${layout === 'grid' ? 'flex flex-col' : ''}`}>
            {showImages && item.meta.coverImage && (
              <div className="relative h-40 w-full">
                <Image
                  src={item.meta.coverImage}
                  alt={item.meta.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  loading="lazy"
                  quality={75}
                />
              </div>
            )}
            <div className="p-5 flex-1 flex flex-col">
              <Link 
                href={item.meta.canonicalUrl || `/content/${item.type}/${item.slug}`}
                className="block hover:underline"
              >
                <h3 className="font-bold text-lg mb-2">{item.meta.title}</h3>
              </Link>
              <p className="text-gray-600 text-sm flex-1 mb-3">
                {item.meta.description.length > 100
                  ? `${item.meta.description.substring(0, 100)}...`
                  : item.meta.description}
              </p>
              {showMetadata && (
                <div className="mt-auto flex justify-between items-center text-xs text-gray-500">
                  <span>
                    {new Date(item.meta.date).toLocaleDateString('en-US', {
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric'
                    })}
                  </span>
                  {item.meta.readingTime && (
                    <span>
                      {typeof item.meta.readingTime === 'string' 
                        ? item.meta.readingTime 
                        : `${item.meta.readingTime} min read`
                      }
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Main component with Suspense wrapper
export default function RecommendedContent(props: RelatedContentProps) {
  return (
    <Suspense fallback={<LoadingSkeleton limit={props.limit || 3} title={props.title || 'Recommended Resources'} />}>
      <RecommendedContentInner {...props} />
    </Suspense>
  );
}

// Alias for RelatedContent (better naming)
export { RecommendedContent as RelatedContent };