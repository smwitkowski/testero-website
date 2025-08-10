import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { 
  getAllContentSlugs, 
  getSpokeContent, 
  getHubContent, 
  getSpokesForHub 
} from '@/lib/content/loader';
import { generateContentMetadata, generateStructuredData } from '@/lib/content/meta';
import { SocialShare, RecommendedContent, ContentMetadata } from '@/components/content';

// Generate static params for all spoke content
export async function generateStaticParams() {
  const { spokeSlugs } = await getAllContentSlugs();
  return spokeSlugs.map(slug => ({ slug }));
}

// Generate metadata for the spoke page
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const unwrappedParams = await params;
  const { slug } = unwrappedParams;
  const content = await getSpokeContent(slug);
  if (!content) return {};
  return generateContentMetadata(content);
}

// For now, we'll just use our default spoke content directly
// This is a workaround for Next.js params issues in SSR
export default async function SpokePage({ params }: { params: Promise<{ slug: string }> }) {
  const unwrappedParams = await params;
  const { slug } = unwrappedParams;
  const content = await getSpokeContent(slug);
  if (!content) notFound();
  
  // Get the parent hub if available
  const hubContent = content.meta.hubSlug 
    ? await getHubContent(content.meta.hubSlug) 
    : null;
  
  // Get related content if we have a hub
  const relatedContent = hubContent && content.meta.hubSlug
    ? await getSpokesForHub(content.meta.hubSlug)
    : [];
  
  // JSON-LD structured data
  const structuredData = generateStructuredData(content);
  
  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        
        {/* Breadcrumb navigation */}
        <nav className="flex items-center text-sm text-gray-500 mb-6">
          <Link href="/content" className="hover:text-gray-700">Resources</Link>
          <span className="mx-2">›</span>
          {hubContent ? (
            <>
              <Link 
                href={`/content/hub/${hubContent.slug}`} 
                className="hover:text-gray-700"
              >
                {hubContent.meta.title}
              </Link>
              <span className="mx-2">›</span>
            </>
          ) : null}
          <span className="text-gray-900">{content.meta.title}</span>
        </nav>
        
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{content.meta.title}</h1>
          <SocialShare 
            title={content.meta.title}
            url={`/content/spoke/${content.slug}`}
            description={content.meta.description}
            className="mb-4"
          />
          <ContentMetadata
            author={content.meta.author}
            publishedAt={content.meta.date}
            updatedAt={content.meta.lastModified}
            readingTime={content.meta.readingTime}
            variant="minimal"
            className="mb-4"
            show={{
              author: true,
              date: true,
              readingTime: true,
              category: false,
              tags: false
            }}
          />
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
          />
        </article>
        
        {/* Page navigation */}
        <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row justify-between">
          {hubContent && (
            <Link 
              href={`/content/hub/${hubContent.slug}`}
              className="mb-4 sm:mb-0 text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to {hubContent.meta.title}
            </Link>
          )}
          <Link 
            href="/content" 
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View all resources
          </Link>
        </div>
        
        {/* Related Content from same hub */}
        <RecommendedContent
          currentSlug={content.slug}
          contentType="spokes"
          category={content.meta.category}
          title={`More About ${hubContent?.meta.title || 'Google Cloud Certifications'}`}
        />
        
        {/* CTAs */}
        <div className="mt-16 p-8 bg-gray-50 rounded-xl">
          <h3 className="text-2xl font-bold mb-4">Ready to take the next step?</h3>
          <p className="text-lg mb-6">
            Sign up for Testero to track your certification progress, access practice exams, 
            and connect with other professionals on the same journey.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              href="/" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium text-center hover:bg-blue-700 transition-colors"
            >
              Get Started with Testero
            </Link>
            <Link 
              href="/" 
              className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium text-center hover:bg-gray-50 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
