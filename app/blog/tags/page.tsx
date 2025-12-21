import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllTags, getAllBlogPosts } from '@/lib/content/blog-loader';
import { BlogPostCard, BlogCategories } from '@/components/blog';

export const metadata: Metadata = {
  title: 'All Tags | Testero Blog',
  description: 'Browse all blog post tags on the Testero PMLE exam prep blog.',
  openGraph: {
    title: 'All Tags | Testero Blog',
    description: 'Browse all blog post tags',
    url: 'https://testero.ai/blog/tags',
    siteName: 'Testero',
    locale: 'en_US',
    type: 'website',
  },
  alternates: {
    canonical: '/blog/tags',
  },
};

export default async function BlogTagsPage() {
  const allTags = await getAllTags();
  const allPosts = await getAllBlogPosts();

  return (
    <article className="mt-12 flex flex-col text-gray-900 dark:text-white">
      <div className="px-5 sm:px-10 md:px-24 flex flex-col">
        <h1 className="mt-6 font-semibold text-2xl md:text-4xl lg:text-5xl">
          All Tags
        </h1>
        <span className="mt-2 inline-block text-gray-600 dark:text-gray-400">
          Browse posts by tag to find content that interests you.
        </span>
      </div>
      
      <BlogCategories 
        categories={allTags} 
        basePath="/blog/tags"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-rows-2 gap-16 mt-5 sm:mt-10 md:mt-24 px-5 sm:px-10 md:px-24">
        {allPosts.map((post) => (
          <article key={post.slug} className="col-span-1 row-span-1 relative">
            <BlogPostCard post={post} variant="grid" />
          </article>
        ))}
      </div>
    </article>
  );
}
