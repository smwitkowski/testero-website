import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { getAllBlogPosts, getAllTags } from '@/lib/content/blog-loader';
import { BlogPostCard, BlogCategories } from '@/components/blog';

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

export default async function BlogPage() {
  const blogPosts = await getAllBlogPosts();
  const allTags = await getAllTags();
  
  // Sort posts by date (newest first)
  const sortedPosts = [...blogPosts].sort((a, b) => {
    const dateA = new Date(a.meta.publishedAt).getTime();
    const dateB = new Date(b.meta.publishedAt).getTime();
    return dateB - dateA;
  });

  const featuredPost = sortedPosts[0];
  const featuredPosts = sortedPosts.slice(1, 4); // Posts 2-4 for featured section
  const recentPosts = sortedPosts.slice(4, 10); // Posts 5-10 for recent section

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-gray-900">
      {/* Cover Section (no image, but styled like template) */}
      {featuredPost && (
        <div className="w-full inline-block">
          <article className="flex flex-col items-start justify-end mx-5 sm:mx-10 relative h-[60vh] sm:h-[85vh] bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl">
            <div className="w-full lg:w-3/4 p-6 sm:p-8 md:p-12 lg:p-16 flex flex-col items-start justify-center z-0 text-white">
              {featuredPost.meta.tags?.[0] && (
                <Link 
                  href={`/blog/tags/${featuredPost.meta.tags[0].toLowerCase().replace(/\s+/g, '-')}`}
                  className="mb-6"
                >
                  <span className="inline-block py-2 sm:py-3 px-6 sm:px-10 bg-white/20 text-white rounded-full capitalize font-semibold border-2 border-solid border-white/30 hover:bg-white/30 transition-all ease duration-200 text-sm sm:text-base">
                    #{featuredPost.meta.tags[0]}
                  </span>
                </Link>
              )}
              <Link href={`/blog/${featuredPost.meta.slug}`} className="mt-6 group">
                <h1 className="font-bold capitalize text-lg sm:text-xl md:text-3xl lg:text-4xl">
                  <span className="bg-gradient-to-r from-white to-white bg-[length:0px_6px] group-hover:bg-[length:100%_6px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500">
                    {featuredPost.meta.title}
                  </span>
                </h1>
              </Link>
              <p className="hidden sm:inline-block mt-4 md:text-lg lg:text-xl">
                {featuredPost.meta.description}
              </p>
            </div>
          </article>
        </div>
      )}

      {/* Featured Posts Section */}
      {featuredPosts.length > 0 && (
        <section className="w-full mt-16 sm:mt-24 md:mt-32 px-5 sm:px-10 md:px-24 flex flex-col items-center justify-center">
          <h2 className="w-full inline-block font-bold capitalize text-2xl md:text-4xl text-gray-900 dark:text-white mb-10">
            Featured Posts
          </h2>

          <div className="grid grid-cols-2 grid-rows-2 gap-6 w-full">
            <article className="col-span-2 xl:col-span-1 row-span-2 relative">
              <BlogPostCard post={featuredPosts[0]} variant="featured" />
            </article>
            {featuredPosts.length > 1 && (
              <article className="col-span-2 sm:col-span-1 row-span-1 relative">
                <BlogPostCard post={featuredPosts[1]} variant="compact" />
              </article>
            )}
            {featuredPosts.length > 2 && (
              <article className="col-span-2 sm:col-span-1 row-span-1 relative">
                <BlogPostCard post={featuredPosts[2]} variant="compact" />
              </article>
            )}
          </div>
        </section>
      )}

      {/* Categories/Tags Navigation */}
      {allTags.length > 0 && (
        <BlogCategories categories={allTags} />
      )}

      {/* Recent Posts Section */}
      {recentPosts.length > 0 && (
        <section className="w-full mt-16 sm:mt-24 md:mt-32 px-5 sm:px-10 md:px-24 flex flex-col items-center justify-center">
          <div className="w-full flex justify-between items-center mb-16">
            <h2 className="w-fit inline-block font-bold capitalize text-2xl md:text-4xl text-gray-900 dark:text-white">
              Recent Posts
            </h2>
            <Link
              href="/blog/tags"
              className="inline-block font-medium text-blue-600 dark:text-blue-400 underline underline-offset-2 text-base md:text-lg"
            >
              view all
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-rows-2 gap-16 w-full">
            {recentPosts.map((post) => (
              <article key={post.slug} className="col-span-1 row-span-1 relative">
                <BlogPostCard post={post} variant="grid" />
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Newsletter CTA */}
      <div className="w-full mt-16 sm:mt-24 md:mt-32 px-5 sm:px-10 md:px-24">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Stay Updated with PMLE Exam Changes
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
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
    </main>
  );
}