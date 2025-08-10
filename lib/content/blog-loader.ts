import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { cache } from "react";
import { contentCache } from "./cache";

export interface BlogMeta {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  category: string;
  tags: string[];
  slug: string;
  readingTime: string;
  featured?: boolean;
  excerpt?: string;
}

export interface BlogPost {
  slug: string;
  content: string;
  meta: BlogMeta;
}

// Blog content directory
const BLOG_CONTENT_DIR = path.join(process.cwd(), "app/content/blog");

// Helper function to check if directory exists
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await fsPromises.access(dirPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Helper function to calculate reading time
function calculateReadingTime(content: string): string {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  const readingTimeMinutes = Math.ceil(wordCount / wordsPerMinute);
  return `${readingTimeMinutes} min read`;
}

// Helper function to generate excerpt from content
function generateExcerpt(content: string, maxLength: number = 160): string {
  // Remove markdown formatting for clean excerpt
  const cleanContent = content
    .replace(/#{1,6}\s+/g, '') // Remove headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italics
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
    .replace(/\n\s*\n/g, ' ') // Replace multiple newlines with space
    .trim();

  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }

  // Find the last complete sentence within the limit
  const truncated = cleanContent.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf('.');
  
  if (lastSentence > maxLength * 0.7) {
    return cleanContent.substring(0, lastSentence + 1);
  }
  
  // Fallback: cut at word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return cleanContent.substring(0, lastSpace) + '...';
}

// Helper function to parse blog post file
const parseBlogFile = async (
  filePath: string,
  slug: string
): Promise<BlogPost> => {
  // Check cache first
  const cacheKey = `blog-${slug}`;
  const cached = await contentCache.get<BlogPost>(cacheKey, filePath);
  if (cached) {
    return cached;
  }

  const fileContents = await fsPromises.readFile(filePath, "utf8");
  const { data, content } = matter(fileContents);

  // Normalize content for better processing
  const normalizedContent = content
    // Replace non-breaking hyphens with regular hyphens
    .replace(/‑/g, "-")
    // Ensure proper spacing around headings
    .replace(/^(#{1,6})\s*/gm, '$1 ')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    // Ensure proper link formatting
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1]($2)');

  // Process markdown to HTML with blog-optimized settings
  const processedContent = await remark()
    .use(remarkGfm) // GitHub Flavored Markdown support
    .use(remarkRehype, { 
      allowDangerousHtml: true,
      footnoteLabel: 'Footnotes',
      footnoteLabelTagName: 'h2'
    })
    .use(rehypeRaw) // Parse HTML in markdown
    .use(rehypeStringify, {
      allowDangerousHtml: true,
      allowDangerousCharacters: true
    })
    .process(normalizedContent);

  const htmlContent = processedContent.toString();

  // Calculate reading time
  const readingTime = calculateReadingTime(content);

  // Generate excerpt if not provided
  const excerpt = data.excerpt || generateExcerpt(content);

  // Validate and normalize frontmatter
  const meta: BlogMeta = {
    title: data.title || 'Untitled',
    description: data.description || excerpt,
    publishedAt: data.publishedAt 
      ? new Date(data.publishedAt).toISOString() 
      : new Date().toISOString(),
    updatedAt: data.updatedAt 
      ? new Date(data.updatedAt).toISOString() 
      : undefined,
    author: data.author || 'Testero Team',
    category: data.category || 'machine-learning',
    tags: Array.isArray(data.tags) ? data.tags : [],
    slug,
    readingTime,
    featured: Boolean(data.featured),
    excerpt,
  };

  const result: BlogPost = {
    slug,
    content: htmlContent,
    meta,
  };

  // Cache the parsed content
  await contentCache.set(cacheKey, result, filePath);

  return result;
};

// Get a single blog post by slug
export const getBlogPost = cache(async (slug: string): Promise<BlogPost | null> => {
  try {
    const filePath = path.join(BLOG_CONTENT_DIR, `${slug}.md`);
    return await parseBlogFile(filePath, slug);
  } catch (error) {
    console.error(`Error fetching blog post for slug ${slug}:`, error);
    return null;
  }
});

// Get all blog posts
export const getAllBlogPosts = cache(async (): Promise<BlogPost[]> => {
  try {
    if (!(await directoryExists(BLOG_CONTENT_DIR))) {
      console.warn(`Blog content directory does not exist: ${BLOG_CONTENT_DIR}`);
      return [];
    }

    const fileNames = await fsPromises.readdir(BLOG_CONTENT_DIR);
    const blogPosts = await Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".md"))
        .map(async (fileName) => {
          const slug = fileName.replace(/\.md$/, "");
          const filePath = path.join(BLOG_CONTENT_DIR, fileName);
          try {
            return await parseBlogFile(filePath, slug);
          } catch (error) {
            console.error(`Error parsing blog post ${fileName}:`, error);
            return null;
          }
        })
    );

    // Filter out null results and sort by date (newest first)
    return blogPosts
      .filter((post): post is BlogPost => post !== null)
      .sort((a, b) => {
        const dateA = new Date(a.meta.publishedAt).getTime();
        const dateB = new Date(b.meta.publishedAt).getTime();
        return dateB - dateA;
      });
  } catch (error) {
    console.error("Error fetching all blog posts:", error);
    return [];
  }
});

// Get blog posts by category
export const getBlogPostsByCategory = cache(async (category: string): Promise<BlogPost[]> => {
  const allPosts = await getAllBlogPosts();
  return allPosts.filter(post => post.meta.category === category);
});

// Get blog posts by tag
export const getBlogPostsByTag = cache(async (tag: string): Promise<BlogPost[]> => {
  const allPosts = await getAllBlogPosts();
  return allPosts.filter(post => post.meta.tags.includes(tag));
});

// Get featured blog posts
export const getFeaturedBlogPosts = cache(async (): Promise<BlogPost[]> => {
  const allPosts = await getAllBlogPosts();
  return allPosts.filter(post => post.meta.featured);
});

// Get recent blog posts (last N posts)
export const getRecentBlogPosts = cache(async (limit: number = 5): Promise<BlogPost[]> => {
  const allPosts = await getAllBlogPosts();
  return allPosts.slice(0, limit);
});

// Get all unique categories
export const getAllCategories = cache(async (): Promise<string[]> => {
  const allPosts = await getAllBlogPosts();
  const categories = new Set(allPosts.map(post => post.meta.category));
  return Array.from(categories).sort();
});

// Get all unique tags
export const getAllTags = cache(async (): Promise<string[]> => {
  const allPosts = await getAllBlogPosts();
  const tags = new Set<string>();
  allPosts.forEach(post => {
    post.meta.tags.forEach(tag => tags.add(tag));
  });
  return Array.from(tags).sort();
});

// Get blog post slugs for static generation
export const getAllBlogSlugs = cache(async (): Promise<string[]> => {
  const allPosts = await getAllBlogPosts();
  return allPosts.map(post => post.slug);
});

// Search blog posts
export const searchBlogPosts = cache(async (query: string): Promise<BlogPost[]> => {
  const allPosts = await getAllBlogPosts();
  const lowerQuery = query.toLowerCase();
  
  return allPosts.filter(post => 
    post.meta.title.toLowerCase().includes(lowerQuery) ||
    post.meta.description.toLowerCase().includes(lowerQuery) ||
    post.meta.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    post.content.toLowerCase().includes(lowerQuery)
  );
});