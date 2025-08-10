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
import { SocialShare, RecommendedContent, ContentMetadata } from '@/components/content';

// Generate static params for all hub content
export async function generateStaticParams() {
  const { hubSlugs } = await getAllContentSlugs();
  return hubSlugs.map(slug => ({ slug }));
}

// Generate metadata for the hub page
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getHubContent(slug);
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
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
            loading="lazy"
            quality={80}
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
        <div className="mt-auto">
          <ContentMetadata
            publishedAt={date}
            readingTime={readingTime}
            variant="compact"
            show={{
              author: false,
              date: true,
              readingTime: true,
              category: false,
              tags: false
            }}
            className="text-sm text-gray-500"
          />
        </div>
      </div>
    </div>
  );
};

export default async function HubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getHubContent(slug);
  if (!content) notFound();
  
  const spokes = await getSpokesForHub(slug);
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
        
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 leading-tight">{content.meta.title}</h1>
          <SocialShare 
            title={content.meta.title}
            url={`/content/hub/${content.slug}`}
            description={content.meta.description}
            className="mb-5"
          />
          <ContentMetadata
            author={content.meta.author}
            publishedAt={content.meta.date}
            updatedAt={content.meta.lastModified}
            readingTime={content.meta.readingTime}
            variant="minimal"
            className="mb-5"
            show={{
              author: true,
              date: true,
              readingTime: true,
              category: false,
              tags: false
            }}
          />
          {content.meta.tags && content.meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {content.meta.tags.map(tag => (
                <span 
                  key={tag} 
                  className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-md text-sm font-medium"
                >
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
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 1200px, 1200px"
                quality={85}
              />
            </div>
          )}
        </header>
        
        <article className="prose prose-lg prose-gray max-w-3xl mx-auto mb-12" id="article-content">
          <div 
            dangerouslySetInnerHTML={{ __html: content.content }} 
            className="certification-content"
            id="certification-content"
          />
        </article>
        
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
          currentSlug={content.slug}
          contentType="hub"
          category={content.meta.category}
          title="More Certification Resources"
        />
      </div>
    </main>
  );
}
