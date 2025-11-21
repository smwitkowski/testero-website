import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllBlogPosts, getBlogPost } from '@/lib/content/blog-loader';
import { ArrowLeft } from 'lucide-react';
import { 
  SocialShare, 
  TableOfContents, 
  ContentMetadata 
} from '@/components/content';

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
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      creator: '@testero_ai',
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

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-50 border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Link 
              href="/blog" 
              className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Blog</span>
            </Link>
            
            <div className="mb-6">
              {meta.category && (
                <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  {meta.category.replace('-', ' ')}
                </span>
              )}
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                {meta.title}
              </h1>
              
              <p className="text-xl text-gray-600 mb-6 leading-relaxed">
                {meta.description}
              </p>
              
              <div className="flex items-center justify-between flex-wrap gap-4">
                <ContentMetadata
                  author={meta.author}
                  publishedAt={meta.publishedAt}
                  updatedAt={meta.updatedAt}
                  readingTime={meta.readingTime}
                  category={meta.category}
                  variant="minimal"
                  show={{
                    author: true,
                    date: true,
                    readingTime: true,
                    category: false,
                    tags: false
                  }}
                />
                
                <SocialShare 
                  url={`https://testero.ai/blog/${slug}`}
                  title={meta.title}
                  description={meta.description}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="lg:grid lg:grid-cols-4 lg:gap-12">
            {/* Table of Contents - Desktop */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="sticky top-8">
                <TableOfContents content={content} />
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <article className="prose prose-lg prose-blue max-w-none dark:prose-invert">
                <div 
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </article>

              {/* Tags */}
              {meta.tags && meta.tags.length > 0 && (
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold mb-4">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {meta.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm hover:bg-gray-200 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Share */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Share this article</h3>
                  <SocialShare 
                    url={`https://testero.ai/blog/${slug}`}
                    title={meta.title}
                    description={meta.description}
                    variant="detailed"
                  />
                </div>
              </div>

              {/* CTA */}
              <div className="mt-12 p-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-4 text-gray-900">
                    Ready to Test Your PMLE Knowledge?
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                    Take our comprehensive diagnostic assessment to identify your strengths 
                    and focus areas for the PMLE exam.
                  </p>
                  <Link 
                    href="/diagnostic" 
                    className="inline-flex items-center space-x-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    <span>Start Free Diagnostic</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        // eslint-disable-next-line no-restricted-syntax
        <section className="bg-gray-50 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
                Related Articles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {relatedPosts.map((relatedPost) => (
                  <article key={relatedPost.slug} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
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
                          className="text-sm text-gray-500"
                        />
                      </div>
                      <Link href={`/blog/${relatedPost.slug}`} className="block hover:no-underline group">
                        <h3 className="text-xl font-semibold mb-2 text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {relatedPost.meta.title}
                        </h3>
                        <p className="text-gray-600 line-clamp-3">
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

      {/* JSON-LD Structured Data */}
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
    </main>
  );
}