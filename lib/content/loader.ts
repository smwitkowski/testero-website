import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
// html is not used since we're using the rehype pipeline
// import html from 'remark-html';
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { cache } from "react";

export interface ContentMeta {
  title: string;
  description: string;
  date: string;
  lastModified?: string;
  author?: string;
  category?: string;
  tags?: string[];
  slug: string;
  type: "hub" | "spoke";
  hubSlug?: string; // For spoke content to reference its hub
  spokeOrder?: number; // For ordering spokes within a hub
  coverImage?: string;
  readingTime?: number;
}

export interface Content {
  slug: string;
  content: string;
  meta: ContentMeta;
}

// Root directories for content
const HUB_CONTENT_DIR = path.join(process.cwd(), "app/content/hub");
const SPOKE_CONTENT_DIR = path.join(process.cwd(), "app/content/spokes");

// Helper function to check if directory exists
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await fsPromises.access(dirPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Helper function to parse content file
const parseContentFile = async (
  filePath: string,
  slug: string,
  type: "hub" | "spoke"
): Promise<Content> => {
  const fileContents = await fsPromises.readFile(filePath, "utf8");
  const { data, content } = matter(fileContents);

  // Normalize special characters before processing
  const normalizedContent = content
    // Replace non-breaking hyphens with regular hyphens
    .replace(/‑/g, "-")
    // Make sure HTML anchors are formatted correctly
    .replace(/<a id="([^"]+)"><\/a>/g, '<a id="$1" class="anchor-link"></a>')
    // Ensure proper spacing around anchor links
    .replace(/<a id="([^"]+)"><\/a>\s*##/g, '<a id="$1" class="anchor-link"></a>\n\n##');

  // Process markdown to HTML with improved rendering
  // Using a full rehype pipeline for better HTML output
  const processedContent = await remark()
    .use(remarkGfm) // GitHub Flavored Markdown support for better lists, tables, etc.
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw) // Parse HTML in the markdown
    .use(rehypeStringify)
    .process(normalizedContent);

  const htmlContent = processedContent.toString();

  // Calculate reading time (approx. 200 words per minute)
  const wordCount = content.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200);

  const meta: ContentMeta = {
    title: data.title,
    description: data.description || "",
    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    lastModified: data.lastModified ? new Date(data.lastModified).toISOString() : undefined,
    author: data.author,
    category: data.category,
    tags: data.tags,
    slug,
    type,
    hubSlug: data.hubSlug,
    spokeOrder: data.spokeOrder,
    coverImage: data.coverImage,
    readingTime,
  };

  return {
    slug,
    content: htmlContent,
    meta,
  };
};

// Get a single hub content by slug
export const getHubContent = cache(async (slug: string): Promise<Content | null> => {
  try {
    const filePath = path.join(HUB_CONTENT_DIR, `${slug}.md`);
    return await parseContentFile(filePath, slug, "hub");
  } catch (error) {
    console.error(`Error fetching hub content for slug ${slug}:`, error);
    return null;
  }
});

// Get a single spoke content by slug
export const getSpokeContent = cache(async (slug: string): Promise<Content | null> => {
  try {
    const filePath = path.join(SPOKE_CONTENT_DIR, `${slug}.md`);
    return await parseContentFile(filePath, slug, "spoke");
  } catch (error) {
    console.error(`Error fetching spoke content for slug ${slug}:`, error);
    return null;
  }
});

// Get all hub content
export const getAllHubContent = cache(async (): Promise<Content[]> => {
  try {
    if (!(await directoryExists(HUB_CONTENT_DIR))) {
      return [];
    }

    const fileNames = await fsPromises.readdir(HUB_CONTENT_DIR);
    const allContent = await Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".md"))
        .map(async (fileName) => {
          const slug = fileName.replace(/\.md$/, "");
          const filePath = path.join(HUB_CONTENT_DIR, fileName);
          return await parseContentFile(filePath, slug, "hub");
        })
    );

    // Sort by date, newest first
    return allContent.sort((a, b) => {
      return new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime();
    });
  } catch (error) {
    console.error("Error fetching all hub content:", error);
    return [];
  }
});

// Get all spoke content
export const getAllSpokeContent = cache(async (): Promise<Content[]> => {
  try {
    if (!(await directoryExists(SPOKE_CONTENT_DIR))) {
      return [];
    }

    const fileNames = await fsPromises.readdir(SPOKE_CONTENT_DIR);
    const allContent = await Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".md"))
        .map(async (fileName) => {
          const slug = fileName.replace(/\.md$/, "");
          const filePath = path.join(SPOKE_CONTENT_DIR, fileName);
          return await parseContentFile(filePath, slug, "spoke");
        })
    );

    // Sort by date, newest first
    return allContent.sort((a, b) => {
      return new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime();
    });
  } catch (error) {
    console.error("Error fetching all spoke content:", error);
    return [];
  }
});

// Get all spoke content for a specific hub
export const getSpokesForHub = cache(async (hubSlug: string): Promise<Content[]> => {
  try {
    const allSpokes = await getAllSpokeContent();
    const hubSpokes = allSpokes.filter((spoke) => spoke.meta.hubSlug === hubSlug);

    // Sort by spokeOrder if available, otherwise by date
    return hubSpokes.sort((a, b) => {
      if (a.meta.spokeOrder !== undefined && b.meta.spokeOrder !== undefined) {
        return a.meta.spokeOrder - b.meta.spokeOrder;
      }
      return new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime();
    });
  } catch (error) {
    console.error(`Error fetching spokes for hub ${hubSlug}:`, error);
    return [];
  }
});

// Get all content slugs for generating static paths
export const getAllContentSlugs = cache(async () => {
  const hubContent = await getAllHubContent();
  const spokeContent = await getAllSpokeContent();

  return {
    hubSlugs: hubContent.map((content) => content.slug),
    spokeSlugs: spokeContent.map((content) => content.slug),
  };
});
