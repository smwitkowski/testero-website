import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Calendar, Clock, User, ArrowLeft } from 'lucide-react';
import { 
  getContentByTypeAndSlug, 
  parseRouteSegments, 
  CONTENT_CONFIG, 
  getCanonicalUrl,
  getAllContentPaths,
  type UnifiedContent 
} from '@/lib/content/config';
import ContentNavigation from '@/components/content/ContentNavigation';
import TableOfContents from '@/components/content/TableOfContents';
import SocialShare from '@/components/content/SocialShare';
import RecommendedContent from '@/components/content/RecommendedContent';

interface ContentPageProps {
  params: {
    slug: string[];
  };
}

// Generate static params for all content
export async function generateStaticParams() {
  const paths = await getAllContentPaths();
  return paths.map(path => ({ slug: path.params.slug }));
}

// Generate metadata for the page
export async function generateMetadata({ params }: ContentPageProps): Promise<Metadata> {
  const { type, slug } = parseRouteSegments(params.slug);
  
  if (!type || !slug) {
    return {
      title: 'Content Not Found | Testero',
      description: 'The requested content could not be found.'
    };
  }

  const content = await getContentByTypeAndSlug(type, slug);
  
  if (!content) {
    return {
      title: 'Content Not Found | Testero',
      description: 'The requested content could not be found.'
    };
  }

  const config = CONTENT_CONFIG[type];
  const canonicalUrl = getCanonicalUrl(type, slug);

  return {
    title: content.meta.title,
    description: content.meta.description,
    authors: content.meta.author ? [{ name: content.meta.author }] : undefined,
    keywords: content.meta.tags ? content.meta.tags.join(', ') : undefined,
    openGraph: {
      title: content.meta.title,
      description: content.meta.description,
      url: canonicalUrl,
      siteName: 'Testero',
      locale: 'en_US',
      type: 'article',
      publishedTime: content.meta.date,
      modifiedTime: content.meta.lastModified,
      images: content.meta.coverImage ? [
        {
          url: content.meta.coverImage,
          width: 1200,
          height: 630,
          alt: content.meta.title,
        }
      ] : [],
      authors: content.meta.author ? [content.meta.author] : undefined,
      tags: content.meta.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: content.meta.title,
      description: content.meta.description,
      images: content.meta.coverImage ? [content.meta.coverImage] : [],
      creator: content.meta.author ? `@${content.meta.author.replace(/\s+/g, '').toLowerCase()}` : undefined,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    other: {
      'article:published_time': content.meta.date,
      'article:modified_time': content.meta.lastModified || content.meta.date,
      'article:author': content.meta.author || 'Testero Team',
      'article:section': content.meta.category || 'certification',
      'article:tag': content.meta.tags?.join(', ') || '',
    }
  };
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatReadingTime(readingTime: number | string | undefined): string {
  if (!readingTime) return '';
  
  if (typeof readingTime === 'string') {
    return readingTime;
  }
  
  return `${readingTime} min read`;
}

function getBackLink(type: string): { href: string; label: string } {
  switch (type) {
    case 'blog':
      return { href: '/blog', label: 'Back to Blog' };
    case 'hub':
      return { href: '/content', label: 'Back to Guides' };
    case 'spokes':
      return { href: '/content', label: 'Back to Resources' };
    default:
      return { href: '/content', label: 'Back to Content' };
  }
}

function renderContentLayout(content: UnifiedContent) {
  const backLink = getBackLink(content.type);
  const readingTime = formatReadingTime(content.meta.readingTime);

  const config = CONTENT_CONFIG[content.type];
  switch (config.layout) {
    case 'article': // Blog posts
      return (
        <article className="max-w-4xl mx-auto">
          {/* Back navigation */}
          <div className="mb-8">
            <Link 
              href={backLink.href}
              className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{backLink.label}</span>
            </Link>
          </div>

          {/* Article header */}
          <header className="mb-8">
            {content.meta.coverImage && (
              <div className="relative w-full h-64 md:h-96 mb-8 rounded-lg overflow-hidden">
                <Image
                  src={content.meta.coverImage}
                  alt={content.meta.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1000px"
                />
              </div>
            )}

            <div className="space-y-4">
              {content.meta.category && (
                <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {content.meta.category.replace('-', ' ').toUpperCase()}
                </div>
              )}

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                {content.meta.title}
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed">
                {content.meta.description}
              </p>

              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>{content.meta.author}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(content.meta.date)}</span>
                </div>
                {readingTime && (
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>{readingTime}</span>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Article content */}
          <div 
            className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100"
            dangerouslySetInnerHTML={{ __html: content.content }}
          />

          {/* Social share */}
          <div className="mt-12 pt-8 border-t">
            <SocialShare 
              title={content.meta.title}
              url={content.meta.canonicalUrl || ''}
            />
          </div>

          {/* Tags */}
          {content.meta.tags && content.meta.tags.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {content.meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </article>
      );

    case 'hub': // Hub content
      return (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main content */}
            <div className="lg:col-span-3">
              <article>
                {/* Back navigation */}
                <div className="mb-6">
                  <Link 
                    href={backLink.href}
                    className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{backLink.label}</span>
                  </Link>
                </div>

                {/* Hub header */}
                <header className="mb-8">
                  {content.meta.coverImage && (
                    <div className="relative w-full h-48 md:h-64 mb-6 rounded-lg overflow-hidden">
                      <Image
                        src={content.meta.coverImage}
                        alt={content.meta.title}
                        fill
                        className="object-cover"
                        priority
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 800px"
                      />
                    </div>
                  )}

                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                    {content.meta.title}
                  </h1>

                  <p className="text-xl text-gray-600 mb-6">
                    {content.meta.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{formatDate(content.meta.date)}</span>
                    {readingTime && <span>• {readingTime}</span>}
                    {content.meta.lastModified && (
                      <span>• Updated {formatDate(content.meta.lastModified)}</span>
                    )}
                  </div>
                </header>

                {/* Hub content */}
                <div 
                  className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{ __html: content.content }}
                />
              </article>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-6">
                <TableOfContents content={content.content} />
                <ContentNavigation currentSlug={content.slug} />
              </div>
            </div>
          </div>
        </div>
      );

    case 'guide': // Spoke content
    default:
      return (
        <article className="max-w-4xl mx-auto">
          {/* Back navigation */}
          <div className="mb-6">
            <Link 
              href={backLink.href}
              className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{backLink.label}</span>
            </Link>
          </div>

          {/* Guide header */}
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {content.meta.title}
            </h1>

            <p className="text-xl text-gray-600 mb-4">
              {content.meta.description}
            </p>

            <div className="flex items-center gap-4 text-sm text-gray-500 pb-4 border-b">
              <span>{formatDate(content.meta.date)}</span>
              {readingTime && <span>• {readingTime}</span>}
            </div>
          </header>

          {/* Guide content */}
          <div 
            className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: content.content }}
          />
        </article>
      );
  }
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { type, slug } = parseRouteSegments(params.slug);

  if (!type || !slug) {
    notFound();
  }

  const content = await getContentByTypeAndSlug(type, slug);

  if (!content) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-12">
        {renderContentLayout(content)}
        
        {/* Recommended content */}
        <div className="mt-16">
          <RecommendedContent 
            currentSlug={content.slug} 
            contentType={content.type}
            category={content.meta.category}
          />
        </div>
      </div>

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: content.meta.title,
            description: content.meta.description,
            author: {
              '@type': 'Organization',
              name: content.meta.author || 'Testero',
            },
            publisher: {
              '@type': 'Organization',
              name: 'Testero',
              logo: {
                '@type': 'ImageObject',
                url: 'https://testero.ai/logo.png',
              },
            },
            datePublished: content.meta.date,
            dateModified: content.meta.lastModified || content.meta.date,
            image: content.meta.coverImage,
            url: content.meta.canonicalUrl,
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': content.meta.canonicalUrl,
            },
            keywords: content.meta.tags?.join(', '),
          }),
        }}
      />
    </main>
  );
}