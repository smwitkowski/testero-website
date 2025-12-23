import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllTags, getAllBlogPosts } from '@/lib/content/blog-loader';
import { BlogPostCard, BlogCategories } from '@/components/blog';

type BlogTagPageProps = {
  params: Promise<{ tag: string }>;
};

export async function generateStaticParams() {
  const tags = await getAllTags();
  return tags.map((tag) => ({
    tag: tag.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
  }));
}

export async function generateMetadata({ params }: BlogTagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const tagDisplay = tag.replace(/-/g, ' ');
  
  return {
    title: `${tagDisplay} Posts | Testero Blog`,
    description: `Browse all blog posts tagged with ${tagDisplay} on the Testero PMLE exam prep blog.`,
    openGraph: {
      title: `${tagDisplay} Posts | Testero Blog`,
      description: `Browse all blog posts tagged with ${tagDisplay}`,
      url: `https://testero.ai/blog/tags/${tag}`,
      siteName: 'Testero',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `/blog/tags/${tag}`,
    },
  };
}

// Helper to normalize tag for comparison
function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export default async function BlogTagPage({ params }: BlogTagPageProps) {
  const { tag } = await params;
  const normalizedTag = normalizeTag(tag);
  
  const allPosts = await getAllBlogPosts();
  const allTags = await getAllTags();
  
  // Find posts that match the tag (case-insensitive, normalized)
  const matchingPosts = allPosts.filter(post => 
    post.meta.tags.some(postTag => normalizeTag(postTag) === normalizedTag)
  );

  if (matchingPosts.length === 0) {
    notFound();
  }

  const tagDisplay = tag.replace(/-/g, ' ');

  return (
    <article className="mt-12 flex flex-col text-gray-900 dark:text-white">
      <div className="px-5 sm:px-10 md:px-24 flex flex-col">
        <h1 className="mt-6 font-semibold text-2xl md:text-4xl lg:text-5xl">
          #{tagDisplay}
        </h1>
        <span className="mt-2 inline-block text-gray-600 dark:text-gray-400">
          Discover more categories and expand your knowledge!
        </span>
      </div>
      
      <BlogCategories 
        categories={allTags} 
        currentSlug={normalizedTag}
        basePath="/blog/tags"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-rows-2 gap-16 mt-5 sm:mt-10 md:mt-24 px-5 sm:px-10 md:px-24">
        {matchingPosts.map((post) => (
          <article key={post.slug} className="col-span-1 row-span-1 relative">
            <BlogPostCard post={post} variant="grid" />
          </article>
        ))}
      </div>
    </article>
  );
}
