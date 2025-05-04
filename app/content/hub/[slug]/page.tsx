import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { 
  getAllContentSlugs, 
  getAllHubContent,
  getHubContent,
  getSpokesForHub
} from '@/lib/content/loader';
import { generateContentMetadata, generateStructuredData } from '@/lib/content/meta';
import TableOfContents from '@/components/content/TableOfContents';
import SocialShare from '@/components/content/SocialShare';
import RecommendedContent from '@/components/content/RecommendedContent';

// Generate static params for all hub content
export async function generateStaticParams() {
  const { hubSlugs } = await getAllContentSlugs();
  return hubSlugs.map(slug => ({ slug }));
}

// Generate metadata for the hub page
export async function generateMetadata() {
  // Default to our main hub content for metadata
  const content = await getHubContent('google-cloud-certification-guide');
  if (!content) return {};
  return generateContentMetadata(content);
}

interface SpokeCardProps {
  title: string;
  description: string;
  slug: string;
  order?: number;
  date: string;
  readingTime?: number;
  coverImage?: string;
}

const SpokeCard = ({ title, description, slug, date, readingTime, coverImage }: SpokeCardProps) => {
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row">
      {coverImage && (
        <div className="relative h-48 md:h-auto md:w-1/3">
          <Image 
            src={coverImage} 
            alt={title} 
            fill 
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      )}
      <div className="p-6 flex-1">
        <Link href={`/content/spoke/${slug}`} className="block hover:underline">
          <h3 className="text-xl font-bold mb-2">{title}</h3>
        </Link>
        <p className="text-gray-700 mb-4">
          {description.length > 120 
            ? `${description.substring(0, 120)}...` 
            : description}
        </p>
        <div className="flex justify-between items-center text-sm text-gray-500 mt-auto">
          <span>
            {new Date(date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          {readingTime && (
            <span>{readingTime} min read</span>
          )}
        </div>
      </div>
    </div>
  );
};

// For now, we'll just use our default hub content directly
// This is a workaround for Next.js params issues in SSR
export default async function HubPage() {
  // Default to showing our main hub content
  const content = await getHubContent('google-cloud-certification-guide');
  if (!content) notFound();
  
  const spokes = await getSpokesForHub('google-cloud-certification-guide');
  const recommendedContent = await getAllHubContent();
  
  // JSON-LD structured data
  const structuredData = generateStructuredData(content);
  
  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{content.meta.title}</h1>
          <SocialShare 
            title={content.meta.title}
            url={`/content/hub/${content.slug}`}
            description={content.meta.description}
            className="mb-4"
          />
          {content.meta.author && (
            <div className="text-gray-600 mb-4">
              By {content.meta.author} • 
              {new Date(content.meta.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {content.meta.readingTime && (
                <span> • {content.meta.readingTime} min read</span>
              )}
            </div>
          )}
          {content.meta.tags && content.meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {content.meta.tags.map(tag => (
                <span key={tag} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {content.meta.coverImage && (
            <div className="relative w-full h-96 mb-8 rounded-lg overflow-hidden">
              <Image 
                src={content.meta.coverImage} 
                alt={content.meta.title} 
                fill 
                className="object-cover"
                priority
              />
            </div>
          )}
        </header>
        
        <div className="flex flex-col lg:flex-row gap-8">
          <article className="prose prose-lg max-w-none mb-12 lg:flex-grow" id="article-content">
            <div 
              dangerouslySetInnerHTML={{ __html: content.content }} 
              className="certification-content"
            />
          </article>
          
          <div className="lg:w-64 lg:flex-shrink-0">
            <div className="sticky top-8">
              <TableOfContents contentId="article-content" className="bg-gray-50 p-4 rounded-lg" />
            </div>
          </div>
        </div>
        
        {spokes.length > 0 && (
          <section className="mt-16">
            <h2 className="text-3xl font-bold mb-6">Related Content</h2>
            <div className="space-y-6">
              {spokes.map((spoke) => (
                <SpokeCard
                  key={spoke.slug}
                  title={spoke.meta.title}
                  description={spoke.meta.description}
                  slug={spoke.slug}
                  order={spoke.meta.spokeOrder}
                  date={spoke.meta.date}
                  readingTime={spoke.meta.readingTime}
                  coverImage={spoke.meta.coverImage}
                />
              ))}
            </div>
          </section>
        )}
        
        <div className="mt-8 pt-8 border-t">
          <Link 
            href="/content" 
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to all resources
          </Link>
        </div>
        
        {/* Recommended Content Section */}
        <RecommendedContent
          content={recommendedContent}
          currentSlug={content.slug}
          title="More Certification Resources"
        />
      </div>
    </main>
  );
}
