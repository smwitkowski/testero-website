import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllBlogPosts, getBlogPost } from '@/lib/content/blog-loader';
import { 
  SocialShare, 
  TableOfContents, 
  ContentMetadata 
} from '@/components/content';
import { BlogDiagnosticCtaLink } from '@/components/blog/BlogDiagnosticCtaLink';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const posts = await getAllBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  
  if (!post) {
    return {
      title: 'Post Not Found | Testero',
      description: 'The requested blog post could not be found.',
    };
  }

  const { meta } = post;
  const publishedTime = new Date(meta.publishedAt).toISOString();
  const modifiedTime = meta.updatedAt ? new Date(meta.updatedAt).toISOString() : publishedTime;
  const coverImageUrl = meta.coverImage ? `https://testero.ai${meta.coverImage}` : undefined;

  return {
    title: `${meta.title} | Testero`,
    description: meta.description,
    authors: [{ name: meta.author }],
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://testero.ai/blog/${slug}`,
      siteName: 'Testero',
      locale: 'en_US',
      type: 'article',
      publishedTime,
      modifiedTime,
      authors: [meta.author],
      tags: meta.tags,
      ...(coverImageUrl && {
        images: [
          {
            url: coverImageUrl,
            width: 1200,
            height: 630,
            alt: meta.title,
          },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      creator: '@testero_ai',
      ...(coverImageUrl && {
        images: [coverImageUrl],
      }),
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
    other: {
      'article:published_time': publishedTime,
      'article:modified_time': modifiedTime,
      'article:author': meta.author,
      'article:section': meta.category || 'Machine Learning',
      ...(meta.tags && { 'article:tag': meta.tags.join(', ') }),
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  
  if (!post) {
    notFound();
  }

  const { meta, content } = post;
  const allPosts = await getAllBlogPosts();
  
  // Get related posts (same category or tags)
  const relatedPosts = allPosts
    .filter((p) => p.slug !== slug)
    .filter((p) => 
      p.meta.category === meta.category || 
      (meta.tags && p.meta.tags && p.meta.tags.some(tag => meta.tags?.includes(tag)))
    )
    .slice(0, 3);

  // Helper to create slug
  const createSlug = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const primaryTag = meta.tags?.[0] || meta.category;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: meta.title,
            description: meta.description,
            author: {
              '@type': 'Person',
              name: meta.author,
            },
            publisher: {
              '@type': 'Organization',
              name: 'Testero',
              logo: {
                '@type': 'ImageObject',
                url: 'https://testero.ai/logo.png',
              },
            },
            datePublished: meta.publishedAt,
            dateModified: meta.updatedAt || meta.publishedAt,
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `https://testero.ai/blog/${slug}`,
            },
            ...(meta.category && {
              articleSection: meta.category,
            }),
            ...(meta.tags && {
              keywords: meta.tags.join(', '),
            }),
          }),
        }}
      />
      <article>
        {/* Blog Details Strip */}
        <div className="px-2 md:px-10 bg-blue-600 dark:bg-blue-500 text-white dark:text-gray-900 py-2 flex items-center justify-around flex-wrap text-lg sm:text-xl font-medium mx-5 md:mx-10 rounded-lg mb-8">
          <time className="m-3">
            {formatDate(meta.publishedAt)}
          </time>
          <div className="m-3">{meta.readingTime}</div>
          {primaryTag && (
            <Link 
              href={`/blog/tags/${createSlug(primaryTag)}`} 
              className="m-3 hover:underline"
            >
              #{primaryTag}
            </Link>
          )}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-12 gap-y-8 lg:gap-8 mt-8 px-5 md:px-10">
          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8">
            {/* Article Header */}
            <div className="mb-8">
              {primaryTag && (
                <Link 
                  href={`/blog/tags/${createSlug(primaryTag)}`}
                  className="inline-block mb-4"
                >
                  <span className="inline-block py-2 sm:py-3 px-6 sm:px-10 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full capitalize font-semibold border-2 border-solid border-gray-900 dark:border-white hover:scale-105 transition-all ease duration-200 text-sm sm:text-base">
                    {primaryTag}
                  </span>
                </Link>
              )}
              <h1 className="inline-block mt-6 font-semibold capitalize text-2xl md:text-3xl lg:text-5xl !leading-normal relative w-full text-gray-900 dark:text-white">
                {meta.title}
              </h1>
            </div>

            {/* Article Content */}
            <article className="prose prose-lg prose-blue max-w-none dark:prose-invert 
              first-letter:text-3xl sm:first-letter:text-5xl
              prose-blockquote:bg-blue-600/20 dark:prose-blockquote:bg-blue-400/20
              prose-blockquote:p-2 prose-blockquote:px-6
              prose-blockquote:border-blue-600 dark:prose-blockquote:border-blue-400
              prose-blockquote:not-italic prose-blockquote:rounded-r-lg
              prose-li:marker:text-blue-600 dark:prose-li:marker:text-blue-400">
              <div 
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </article>

            {/* Tags */}
            {meta.tags && meta.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {meta.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog/tags/${createSlug(tag)}`}
                      className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Share */}
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Share this article</h3>
                <SocialShare 
                  url={`https://testero.ai/blog/${slug}`}
                  title={meta.title}
                  description={meta.description}
                  variant="detailed"
                />
              </div>
            </div>

            {/* CTA */}
            <div className="mt-12 p-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                  Ready to Test Your PMLE Knowledge?
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
                  Take our comprehensive diagnostic assessment to identify your strengths 
                  and focus areas for the PMLE exam.
                </p>
                <BlogDiagnosticCtaLink
                  href="/diagnostic"
                  className="inline-flex items-center space-x-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <span>Start Free Diagnostic</span>
                  <span>→</span>
                </BlogDiagnosticCtaLink>
              </div>
            </div>
          </div>

          {/* Table of Contents - Right Rail */}
          <div className="col-span-12 lg:col-span-4">
            <details
              className="border border-solid border-gray-900 dark:border-gray-100 text-gray-900 dark:text-white rounded-lg p-4 sticky top-6 max-h-screen overflow-hidden overflow-y-auto"
              open
            >
              <summary className="text-lg font-semibold capitalize cursor-pointer mb-4">
                Table Of Content
              </summary>
              <TableOfContents 
                content={content} 
                headingLevels={[2, 3]}
                className="mt-4"
              />
            </details>
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        // eslint-disable-next-line no-restricted-syntax
        <section className="bg-gray-50 dark:bg-gray-800 py-16 mt-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
                Related Articles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {relatedPosts.map((relatedPost) => (
                  <article key={relatedPost.slug} className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="mb-3">
                        <ContentMetadata
                          publishedAt={relatedPost.meta.publishedAt}
                          readingTime={relatedPost.meta.readingTime}
                          variant="compact"
                          show={{
                            author: false,
                            date: true,
                            readingTime: true,
                            category: false,
                            tags: false
                          }}
                          className="text-sm text-gray-500 dark:text-gray-400"
                        />
                      </div>
                      <Link href={`/blog/${relatedPost.slug}`} className="block hover:no-underline group">
                        <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                          {relatedPost.meta.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 line-clamp-3">
                          {relatedPost.meta.description}
                        </p>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}