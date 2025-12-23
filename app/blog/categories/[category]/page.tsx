import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllCategories, getAllBlogPosts } from '@/lib/content/blog-loader';
import { BlogPostCard, BlogCategories } from '@/components/blog';

type BlogCategoryPageProps = {
  params: Promise<{ category: string }>;
};

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((category) => ({
    category: category.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
  }));
}

export async function generateMetadata({ params }: BlogCategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const categoryDisplay = category.replace(/-/g, ' ');
  
  return {
    title: `${categoryDisplay} Posts | Testero Blog`,
    description: `Browse all blog posts in the ${categoryDisplay} category on the Testero PMLE exam prep blog.`,
    openGraph: {
      title: `${categoryDisplay} Posts | Testero Blog`,
      description: `Browse all blog posts in the ${categoryDisplay} category`,
      url: `https://testero.ai/blog/categories/${category}`,
      siteName: 'Testero',
      locale: 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: `/blog/categories/${category}`,
    },
  };
}

// Helper to normalize category for comparison
function normalizeCategory(category: string): string {
  return category.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export default async function BlogCategoryPage({ params }: BlogCategoryPageProps) {
  const { category } = await params;
  const normalizedCategory = normalizeCategory(category);
  
  const allPosts = await getAllBlogPosts();
  const allCategories = await getAllCategories();
  
  // Find posts that match the category (case-insensitive, normalized)
  const matchingPosts = allPosts.filter(post => 
    normalizeCategory(post.meta.category) === normalizedCategory
  );

  if (matchingPosts.length === 0) {
    notFound();
  }

  const categoryDisplay = category.replace(/-/g, ' ');

  return (
    <article className="mt-12 flex flex-col text-gray-900 dark:text-white">
      <div className="px-5 sm:px-10 md:px-24 flex flex-col">
        <h1 className="mt-6 font-semibold text-2xl md:text-4xl lg:text-5xl">
          #{categoryDisplay}
        </h1>
        <span className="mt-2 inline-block text-gray-600 dark:text-gray-400">
          Discover more categories and expand your knowledge!
        </span>
      </div>
      
      <BlogCategories 
        categories={allCategories} 
        currentSlug={normalizedCategory}
        basePath="/blog/categories"
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
