/* eslint-disable @typescript-eslint/no-explicit-any */
import { getAllHubContent, getAllSpokeContent, getHubContent, getSpokeContent, getContent, getAllContent } from './loader';
import { getAllBlogPosts, getBlogPost } from './blog-loader';
import type { Content } from './loader';
import type { BlogPost } from './blog-loader';

/**
 * Content type configuration for unified routing
 */
export interface ContentTypeConfig {
  path: string;          // File system path relative to app/content/
  urlPrefix: string;     // URL prefix for this content type
  layout: 'article' | 'guide' | 'hub';
  allowNested: boolean;  // Support for nested hierarchies
  seoConfig: {
    titleTemplate: string;
    defaultTitle: string;
    description: string;
  };
}

export const CONTENT_CONFIG: Record<string, ContentTypeConfig> = {
  blog: {
    path: 'blog',
    urlPrefix: '/blog',
    layout: 'article',
    allowNested: false,
    seoConfig: {
      titleTemplate: '%s | PMLE Exam Prep Blog | Testero',
      defaultTitle: 'PMLE Exam Prep Blog | Expert Machine Learning Certification Insights',
      description: 'In-depth articles, guides, and strategies for acing the Google Professional Machine Learning Engineer certification exam.'
    }
  },
  hub: {
    path: 'hub',
    urlPrefix: '/content/hub',
    layout: 'hub',
    allowNested: false,
    seoConfig: {
      titleTemplate: '%s | Google Certification Guide | Testero',
      defaultTitle: 'Google Certification Guides | Comprehensive Resources',
      description: 'Comprehensive guides for Google certifications to accelerate your career in cloud, data analytics, machine learning, and more.'
    }
  },
  guides: {
    path: 'guides',
    urlPrefix: '/content/guides',
    layout: 'guide',
    allowNested: false,
    seoConfig: {
      titleTemplate: '%s | Complete Guide | Testero',
      defaultTitle: 'Complete Certification Guides | Step-by-Step Resources',
      description: 'Comprehensive step-by-step guides for Google Cloud and ML certifications with practical study plans and expert insights.'
    }
  },
  spokes: {
    path: 'spokes',
    urlPrefix: '/content/spoke',
    layout: 'guide',
    allowNested: false,
    seoConfig: {
      titleTemplate: '%s | Certification Resource | Testero',
      defaultTitle: 'Google Certification Resources',
      description: 'Detailed resources and guides for Google professional certifications.'
    }
  }
};

/**
 * Unified content interface that wraps both blog posts and content
 */
export interface UnifiedContent {
  slug: string;
  content: string;
  type: keyof typeof CONTENT_CONFIG;
  meta: {
    title: string;
    description: string;
    date: string;
    lastModified?: string;
    author?: string;
    category?: string;
    tags?: string[];
    readingTime?: number | string;
    coverImage?: string;
    canonicalUrl?: string;
  };
}

/**
 * Convert blog post to unified content format
 */
function blogPostToUnified(post: BlogPost): UnifiedContent {
  return {
    slug: post.slug,
    content: post.content,
    type: 'blog',
    meta: {
      title: post.meta.title,
      description: post.meta.description,
      date: post.meta.publishedAt,
      lastModified: post.meta.updatedAt,
      author: post.meta.author,
      category: post.meta.category,
      tags: post.meta.tags,
      readingTime: post.meta.readingTime,
      canonicalUrl: `/blog/${post.slug}`
    }
  };
}

/**
 * Convert content to unified content format
 */
function contentToUnified(content: Content, type: 'hub' | 'spokes' | 'guides'): UnifiedContent {
  return {
    slug: content.slug,
    content: content.content,
    type,
    meta: {
      title: content.meta.title,
      description: content.meta.description,
      date: content.meta.date,
      lastModified: content.meta.lastModified,
      author: content.meta.author,
      category: content.meta.category,
      tags: content.meta.tags,
      readingTime: content.meta.readingTime,
      coverImage: content.meta.coverImage,
      canonicalUrl: type === 'hub' ? `/content/hub/${content.slug}` : 
                   type === 'guides' ? `/content/guides/${content.slug}` : 
                   `/content/spoke/${content.slug}`
    }
  };
}

/**
 * Get content by type and slug
 */
export async function getContentByTypeAndSlug(
  type: keyof typeof CONTENT_CONFIG, 
  slug: string
): Promise<UnifiedContent | null> {
  try {
    switch (type) {
      case 'blog': {
        const post = await getBlogPost(slug);
        return post ? blogPostToUnified(post) : null;
      }
      case 'hub': {
        const content = await getHubContent(slug);
        return content ? contentToUnified(content, 'hub') : null;
      }
      case 'guides': {
        const content = await getGuideContent(slug);
        return content ? contentToUnified(content, 'guides') : null;
      }
      case 'spokes': {
        const content = await getSpokeContent(slug);
        return content ? contentToUnified(content, 'spokes') : null;
      }
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error fetching ${type} content for slug ${slug}:`, error);
    return null;
  }
}

/**
 * Get all content for a specific type
 */
export async function getAllContentByType(type: keyof typeof CONTENT_CONFIG): Promise<UnifiedContent[]> {
  try {
    switch (type) {
      case 'blog': {
        const posts = await getAllBlogPosts();
        return posts.map(blogPostToUnified);
      }
      case 'hub': {
        const content = await getAllHubContent();
        return content.map(c => contentToUnified(c, 'hub'));
      }
      case 'guides': {
        const content = await getAllGuideContent();
        return content.map(c => contentToUnified(c, 'guides'));
      }
      case 'spokes': {
        const content = await getAllSpokeContent();
        return content.map(c => contentToUnified(c, 'spokes'));
      }
      default:
        return [];
    }
  } catch (error) {
    console.error(`Error fetching all ${type} content:`, error);
    return [];
  }
}

/**
 * Parse route segments to determine content type and slug
 */
export function parseRouteSegments(segments: string[]): { 
  type: keyof typeof CONTENT_CONFIG | null; 
  slug: string | null; 
} {
  if (!segments || segments.length === 0) {
    return { type: null, slug: null };
  }

  // Handle direct content type routes: /content/blog/slug or /content/hub/slug
  if (segments.length === 2) {
    const [contentType, slug] = segments;
    
    if (contentType in CONTENT_CONFIG && slug) {
      return { type: contentType as keyof typeof CONTENT_CONFIG, slug };
    }
  }

  // Handle legacy blog routes: /blog/slug -> should redirect to /content/blog/slug
  if (segments.length === 1) {
    const [slug] = segments;
    
    // Check if this slug exists in any content type
    // For now, assume it's a hub content if it's a single segment under /content
    return { type: 'hub', slug };
  }

  return { type: null, slug: null };
}

/**
 * Get canonical URL for content
 */
export function getCanonicalUrl(type: keyof typeof CONTENT_CONFIG, slug: string): string {
  const config = CONTENT_CONFIG[type];
  if (!config) return `/content/${slug}`;
  
  return `${config.urlPrefix}/${slug}`;
}

/**
 * Get all content paths for static generation
 */
export async function getAllContentPaths(): Promise<Array<{ params: { slug: string[] } }>> {
  const paths: Array<{ params: { slug: string[] } }> = [];

  // Add blog paths
  const blogPosts = await getAllBlogPosts();
  blogPosts.forEach(post => {
    paths.push({ params: { slug: ['blog', post.slug] } });
  });

  // Add hub paths
  const hubContent = await getAllHubContent();
  hubContent.forEach(content => {
    paths.push({ params: { slug: ['hub', content.slug] } });
  });

  // Add guide paths
  const guideContent = await getAllGuideContent();
  guideContent.forEach(content => {
    paths.push({ params: { slug: ['guides', content.slug] } });
  });

  // Add spoke paths
  const spokeContent = await getAllSpokeContent();
  spokeContent.forEach(content => {
    paths.push({ params: { slug: ['spoke', content.slug] } });
  });

  return paths;
}

/**
 * Generate sitemap entries for all content
 */
export async function generateContentSitemapEntries(): Promise<Array<{
  url: string;
  lastModified: string;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}>> {
  const entries: Array<{
    url: string;
    lastModified: string;
    changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    priority: number;
  }> = [];

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://testero.ai';

  // Blog entries
  const blogPosts = await getAllBlogPosts();
  blogPosts.forEach(post => {
    entries.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.meta.updatedAt || post.meta.publishedAt,
      changeFrequency: 'monthly',
      priority: 0.8
    });
  });

  // Hub entries
  const hubContent = await getAllHubContent();
  hubContent.forEach(content => {
    entries.push({
      url: `${baseUrl}/content/hub/${content.slug}`,
      lastModified: content.meta.lastModified || content.meta.date,
      changeFrequency: 'monthly',
      priority: 0.9
    });
  });

  // Guide entries
  const guideContent = await getAllGuideContent();
  guideContent.forEach(content => {
    entries.push({
      url: `${baseUrl}/content/guides/${content.slug}`,
      lastModified: content.meta.lastModified || content.meta.date,
      changeFrequency: 'monthly',
      priority: 0.9
    });
  });

  // Spoke entries
  const spokeContent = await getAllSpokeContent();
  spokeContent.forEach(content => {
    entries.push({
      url: `${baseUrl}/content/spoke/${content.slug}`,
      lastModified: content.meta.lastModified || content.meta.date,
      changeFrequency: 'monthly',
      priority: 0.7
    });
  });

  return entries;
}

/**
 * Legacy guide helper functions
 */

// Get a single guide content by slug (legacy compatibility)
export const getGuideContent = async (slug: string): Promise<Content | null> => {
  const content = await getContent('guide', slug);
  if (!content) return null;

  // Transform to legacy format
  const meta = content.meta as any;
  return {
    slug: content.slug,
    content: content.content,
    meta: {
      title: meta.title,
      description: meta.description,
      date: meta.date || new Date(meta.publishedAt).toISOString(),
      lastModified: meta.lastModified || (meta.updatedAt ? new Date(meta.updatedAt).toISOString() : undefined),
      author: meta.author,
      category: meta.category,
      tags: meta.tags,
      slug: content.slug,
      type: 'hub' as const, // Use hub type for compatibility
      hubSlug: undefined,
      spokeOrder: undefined,
      coverImage: meta.coverImage,
      readingTime: parseInt(meta.readingTime?.split(' ')[0] || '5'),
    }
  };
};

// Get all guide content (legacy compatibility)
export const getAllGuideContent = async (): Promise<Content[]> => {
  const content = await getAllContent('guide');
  return content.map(item => {
    const meta = item.meta as any;
    return {
      slug: item.slug,
      content: item.content,
      meta: {
        title: meta.title,
        description: meta.description,
        date: meta.date || new Date(meta.publishedAt).toISOString(),
        lastModified: meta.lastModified || (meta.updatedAt ? new Date(meta.updatedAt).toISOString() : undefined),
        author: meta.author,
        category: meta.category,
        tags: meta.tags,
        slug: item.slug,
        type: 'hub' as const, // Use hub type for compatibility
        hubSlug: undefined,
        spokeOrder: undefined,
        coverImage: meta.coverImage,
        readingTime: parseInt(meta.readingTime?.split(' ')[0] || '5'),
      }
    };
  });
};