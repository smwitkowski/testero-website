import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { getAllBlogPosts, BlogPost } from '@/lib/content/blog-loader';
import { Clock, Calendar, User, Tag } from 'lucide-react';

export const metadata: Metadata = {
  title: 'PMLE Exam Prep Blog | Expert Machine Learning Certification Insights',
  description: 'In-depth articles, guides, and strategies for acing the Google Professional Machine Learning Engineer certification exam. Expert insights, study tips, and real-world scenarios.',
  openGraph: {
    title: 'PMLE Exam Prep Blog | Expert Machine Learning Certification Insights',
    description: 'In-depth articles, guides, and strategies for acing the Google Professional Machine Learning Engineer certification exam. Expert insights, study tips, and real-world scenarios.',
    url: 'https://testero.ai/blog',
    siteName: 'Testero',
    locale: 'en_US',
    type: 'website',
  },
  alternates: {
    canonical: '/blog',
  },
};

type BlogCardProps = {
  post: BlogPost;
};

const BlogCard = ({ post }: BlogCardProps) => {
  const { meta } = post;
  
  return (
    <article className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 bg-white">
      <div className="p-6">
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <time dateTime={meta.publishedAt}>
              {new Date(meta.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>
          {meta.readingTime && (
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{meta.readingTime}</span>
            </div>
          )}
        </div>

        <Link href={`/blog/${meta.slug}`} className="block hover:no-underline group">
          <h2 className="text-2xl font-bold mb-3 text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
            {meta.title}
          </h2>
        </Link>

        <p className="text-gray-700 mb-4 line-clamp-3 leading-relaxed">
          {meta.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{meta.author}</span>
            </div>
          </div>

          {meta.category && (
            <div className="flex items-center space-x-1">
              <Tag className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 capitalize bg-gray-100 px-2 py-1 rounded-full">
                {meta.category.replace('-', ' ')}
              </span>
            </div>
          )}
        </div>

        {meta.tags && meta.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {meta.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
            {meta.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{meta.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

export default async function BlogPage() {
  const blogPosts = await getAllBlogPosts();
  
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
              PMLE Exam Prep Blog
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Expert insights, study strategies, and comprehensive guides to help you master the 
              Google Professional Machine Learning Engineer certification exam.
            </p>
          </div>

          {/* Featured Article */}
          {blogPosts.length > 0 && (
            <div className="mb-12">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
                <div className="max-w-4xl">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Featured
                    </span>
                    <span className="text-white/80 text-sm">
                      {new Date(blogPosts[0].meta.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Link href={`/blog/${blogPosts[0].meta.slug}`} className="block hover:no-underline group">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 group-hover:text-blue-200 transition-colors">
                      {blogPosts[0].meta.title}
                    </h2>
                    <p className="text-xl text-white/90 mb-6 leading-relaxed">
                      {blogPosts[0].meta.description}
                    </p>
                    <div className="inline-flex items-center space-x-2 bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors">
                      <span>Read Article</span>
                      <span>→</span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Blog Posts Grid */}
          {blogPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No blog posts available yet. Check back soon!</p>
            </div>
          ) : (
            <>
              {blogPosts.length > 1 && (
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-8">Latest Articles</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {blogPosts.slice(1).map((post) => (
                      <BlogCard key={post.slug} post={post} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Newsletter CTA */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center">
            <h3 className="text-2xl font-bold mb-4 text-gray-900">
              Stay Updated with PMLE Exam Changes
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Get notified when we publish new study guides, exam updates, and insider tips 
              to help you succeed on your certification journey.
            </p>
            <Link 
              href="/diagnostic" 
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <span>Start Your PMLE Diagnostic</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}