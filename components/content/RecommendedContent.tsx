import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Content } from '@/lib/content/loader';

interface RecommendedContentProps {
  content: Content[];
  currentSlug?: string;
  title?: string;
  limit?: number;
}

export default function RecommendedContent({
  content,
  currentSlug,
  title = 'Recommended Resources',
  limit = 3
}: RecommendedContentProps) {
  // Filter out the current content and limit to specified number
  const filteredContent = content
    .filter(item => item.slug !== currentSlug)
    .slice(0, limit);
  
  if (filteredContent.length === 0) return null;
  
  return (
    <section className="mt-12 bg-gray-50 rounded-xl p-8">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContent.map((item) => (
          <div key={item.slug} className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
            {item.meta.coverImage && (
              <div className="relative h-40 w-full">
                <Image
                  src={item.meta.coverImage}
                  alt={item.meta.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            )}
            <div className="p-5 flex-1 flex flex-col">
              <Link 
                href={`/content/${item.meta.type}/${item.slug}`}
                className="block hover:underline"
              >
                <h3 className="font-bold text-lg mb-2">{item.meta.title}</h3>
              </Link>
              <p className="text-gray-600 text-sm flex-1 mb-3">
                {item.meta.description.length > 100
                  ? `${item.meta.description.substring(0, 100)}...`
                  : item.meta.description}
              </p>
              <div className="mt-auto flex justify-between items-center text-xs text-gray-500">
                <span>
                  {new Date(item.meta.date).toLocaleDateString('en-US', {
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric'
                  })}
                </span>
                {item.meta.readingTime && (
                  <span>{item.meta.readingTime} min read</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
