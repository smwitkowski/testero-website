/**
 * MDX compilation configuration for Testero content system
 * 
 * Provides unified MDX processing with custom components support,
 * syntax highlighting, and content optimization for all content types.
 */

import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import type { ContentTransformOptions } from './types';

/**
 * Default MDX processing options
 */
export const DEFAULT_MDX_OPTIONS: ContentTransformOptions = {
  enableGFM: true,
  enableRawHTML: true,
  generateTOC: false,
  enableSyntaxHighlighting: true,
  generateReadingTime: true,
  generateWordCount: true,
  optimizeImages: true,
  strictValidation: false,
  validateLinks: false,
  validateImages: false,
};

/**
 * Custom MDX components for enhanced content rendering
 */
export const MDX_COMPONENTS = {
  // Enhanced headings with automatic anchor links
  h1: ({ children, id, ...props }: any) => (
    `<h1 id="${id || ''}" class="text-3xl font-bold mb-4 text-gray-900 dark:text-white" {...props}>
      ${children}
      ${id ? `<a href="#${id}" class="anchor-link ml-2 opacity-0 hover:opacity-100 text-blue-600 hover:text-blue-800" aria-label="Link to this section">#</a>` : ''}
    </h1>`
  ),
  
  h2: ({ children, id, ...props }: any) => (
    `<h2 id="${id || ''}" class="text-2xl font-semibold mb-3 mt-8 text-gray-900 dark:text-white" {...props}>
      ${children}
      ${id ? `<a href="#${id}" class="anchor-link ml-2 opacity-0 hover:opacity-100 text-blue-600 hover:text-blue-800" aria-label="Link to this section">#</a>` : ''}
    </h2>`
  ),
  
  h3: ({ children, id, ...props }: any) => (
    `<h3 id="${id || ''}" class="text-xl font-semibold mb-2 mt-6 text-gray-900 dark:text-white" {...props}>
      ${children}
      ${id ? `<a href="#${id}" class="anchor-link ml-2 opacity-0 hover:opacity-100 text-blue-600 hover:text-blue-800" aria-label="Link to this section">#</a>` : ''}
    </h3>`
  ),

  // Enhanced paragraphs with better spacing
  p: ({ children, ...props }: any) => (
    `<p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed" {...props}>${children}</p>`
  ),

  // Enhanced lists with better styling
  ul: ({ children, ...props }: any) => (
    `<ul class="mb-4 space-y-2 list-disc list-inside text-gray-700 dark:text-gray-300" {...props}>${children}</ul>`
  ),
  
  ol: ({ children, ...props }: any) => (
    `<ol class="mb-4 space-y-2 list-decimal list-inside text-gray-700 dark:text-gray-300" {...props}>${children}</ol>`
  ),
  
  li: ({ children, ...props }: any) => (
    `<li class="leading-relaxed" {...props}>${children}</li>`
  ),

  // Enhanced blockquotes
  blockquote: ({ children, ...props }: any) => (
    `<blockquote class="border-l-4 border-blue-500 pl-4 mb-4 italic text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 py-3 rounded-r" {...props}>
      ${children}
    </blockquote>`
  ),

  // Enhanced code blocks with syntax highlighting
  pre: ({ children, ...props }: any) => (
    `<div class="mb-4 rounded-lg overflow-hidden">
      <pre class="bg-gray-900 text-gray-100 p-4 overflow-x-auto text-sm" {...props}>${children}</pre>
    </div>`
  ),
  
  code: ({ children, className, ...props }: any) => {
    // Inline code
    if (!className) {
      return `<code class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>${children}</code>`;
    }
    // Code block (handled by pre wrapper)
    return `<code class="${className}" {...props}>${children}</code>`;
  },

  // Enhanced tables
  table: ({ children, ...props }: any) => (
    `<div class="mb-4 overflow-x-auto">
      <table class="min-w-full border border-gray-200 dark:border-gray-700" {...props}>${children}</table>
    </div>`
  ),
  
  th: ({ children, ...props }: any) => (
    `<th class="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700" {...props}>${children}</th>`
  ),
  
  td: ({ children, ...props }: any) => (
    `<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700" {...props}>${children}</td>`
  ),

  // Enhanced links
  a: ({ children, href, ...props }: any) => {
    const isExternal = href && (href.startsWith('http') || href.startsWith('https'));
    const externalProps = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
    const externalIcon = isExternal ? ' <span class="inline-block w-3 h-3 ml-1">↗</span>' : '';
    
    return `<a href="${href}" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline" ${externalProps} {...props}>
      ${children}${externalIcon}
    </a>`;
  },

  // Enhanced images with optimization
  img: ({ src, alt, title, ...props }: any) => (
    `<div class="mb-4">
      <img src="${src}" alt="${alt || ''}" title="${title || ''}" 
           class="max-w-full h-auto rounded-lg shadow-sm" 
           loading="lazy" 
           {...props} />
      ${title ? `<p class="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center italic">${title}</p>` : ''}
    </div>`
  ),

  // Custom callout boxes
  callout: ({ type = 'info', children, ...props }: any) => {
    const styles = {
      info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100',
      warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100',
      error: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100',
      success: 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100'
    };
    
    const style = styles[type as keyof typeof styles] || styles.info;
    
    return `<div class="border-l-4 p-4 mb-4 rounded-r ${style}" {...props}>
      ${children}
    </div>`;
  },

  // Custom exam tip component
  examTip: ({ children, ...props }: any) => (
    `<div class="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4" {...props}>
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <span class="text-green-600 dark:text-green-400 text-lg">💡</span>
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Exam Tip</p>
          <div class="text-green-700 dark:text-green-300">${children}</div>
        </div>
      </div>
    </div>`
  ),

  // Custom practice question component
  practiceQuestion: ({ question, options, answer, explanation, ...props }: any) => (
    `<div class="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4" {...props}>
      <h4 class="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">Practice Question</h4>
      <div class="mb-4">
        <p class="text-blue-800 dark:text-blue-200 font-medium">${question}</p>
      </div>
      ${options ? `
        <div class="mb-4">
          <ul class="space-y-2">
            ${options.map((option: string, index: number) => 
              `<li class="text-blue-700 dark:text-blue-300">
                <span class="font-semibold">${String.fromCharCode(65 + index)}.</span> ${option}
              </li>`
            ).join('')}
          </ul>
        </div>
      ` : ''}
      ${answer ? `
        <div class="mb-2">
          <p class="text-sm font-semibold text-blue-900 dark:text-blue-100">Answer: ${answer}</p>
        </div>
      ` : ''}
      ${explanation ? `
        <div class="text-sm text-blue-800 dark:text-blue-200">
          <strong>Explanation:</strong> ${explanation}
        </div>
      ` : ''}
    </div>`
  ),
};

/**
 * Create a simplified MDX processor with custom options
 */
export function createMDXProcessor(options: Partial<ContentTransformOptions> = {}) {
  const config = { ...DEFAULT_MDX_OPTIONS, ...options };
  
  let processor = remark();
  
  // Add GitHub Flavored Markdown support
  if (config.enableGFM) {
    processor = processor.use(remarkGfm);
  }
  
  // Convert to HTML with rehype
  processor = processor
    .use(remarkRehype, { 
      allowDangerousHtml: config.enableRawHTML,
      footnoteLabelTagName: 'h4',
      footnoteLabel: 'References'
    })
    .use(rehypeRaw) // Parse raw HTML 
    .use(rehypeStringify, {
      allowDangerousHtml: config.enableRawHTML,
      allowDangerousCharacters: true,
      quoteSmart: true,
      closeSelfClosing: true
    });
  
  return processor;
}

/**
 * Process MDX content to HTML
 */
export async function processMDX(
  content: string, 
  options: Partial<ContentTransformOptions> = {}
): Promise<string> {
  const startTime = Date.now();
  
  try {
    // Normalize content before processing
    const normalizedContent = normalizeMDXContent(content);
    
    // Create processor with options
    const processor = createMDXProcessor(options);
    
    // Process the content
    const result = await processor.process(normalizedContent);
    const htmlContent = result.toString();
    
    // Log processing time for performance monitoring
    const processingTime = Date.now() - startTime;
    if (processingTime > 100) {
      console.warn(`MDX processing took ${processingTime}ms - consider optimizing`);
    }
    
    return htmlContent;
  } catch (error) {
    console.error('MDX processing failed:', error);
    // Return original content wrapped in pre tag as fallback
    return `<pre class="bg-red-50 border border-red-200 p-4 rounded text-red-700">
      Error processing content: ${error instanceof Error ? error.message : 'Unknown error'}
    </pre>`;
  }
}

/**
 * Normalize MDX content for consistent processing
 */
function normalizeMDXContent(content: string): string {
  return content
    // Fix non-breaking hyphens
    .replace(/‑/g, '-')
    // Ensure proper heading spacing
    .replace(/^(#{1,6})\s*/gm, '$1 ')
    // Clean up excessive newlines
    .replace(/\n{4,}/g, '\n\n\n')
    // Ensure proper code block formatting
    .replace(/```(\w+)?\n/g, '```$1\n')
    // Fix anchor links
    .replace(/<a id="([^"]+)"><\/a>/g, '<a id="$1" class="anchor-link"></a>')
    // Ensure proper spacing around anchor links
    .replace(/<a id="([^"]+)"><\/a>\s*##/g, '<a id="$1" class="anchor-link"></a>\n\n##')
    // Clean up link formatting
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1]($2)')
    // Fix table formatting
    .replace(/\|\s*\|/g, '| |')
    // Clean up whitespace
    .trim();
}

/**
 * Extract metadata from processed HTML
 */
export function extractMDXMetadata(htmlContent: string) {
  const headings = extractHeadings(htmlContent);
  const images = extractImages(htmlContent);
  const links = extractLinks(htmlContent);
  const codeBlocks = extractCodeBlocks(htmlContent);
  
  return {
    headings,
    images,
    externalLinks: links.external,
    internalLinks: links.internal,
    codeBlocks,
    wordCount: calculateWordCount(htmlContent),
    readingTimeMinutes: calculateReadingTime(htmlContent),
  };
}

/**
 * Extract headings from HTML content
 */
function extractHeadings(htmlContent: string) {
  const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[1-6]>/gi;
  const headings: Array<{ level: number; id: string; text: string }> = [];
  
  let match;
  while ((match = headingRegex.exec(htmlContent)) !== null) {
    const level = parseInt(match[1]);
    const id = match[2];
    const text = match[3].replace(/<[^>]*>/g, '').trim();
    
    if (text) {
      headings.push({ level, id, text });
    }
  }
  
  return headings;
}

/**
 * Extract images from HTML content
 */
function extractImages(htmlContent: string) {
  const imgRegex = /<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi;
  const images: Array<{ src: string; alt: string }> = [];
  
  let match;
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    images.push({
      src: match[1],
      alt: match[2] || ''
    });
  }
  
  return images;
}

/**
 * Extract links from HTML content
 */
function extractLinks(htmlContent: string) {
  const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  const external: Array<{ href: string; text: string }> = [];
  const internal: Array<{ href: string; text: string }> = [];
  
  let match;
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    
    const isExternal = href.startsWith('http') || href.startsWith('https');
    const linkData = { href, text };
    
    if (isExternal) {
      external.push(linkData);
    } else {
      internal.push(linkData);
    }
  }
  
  return { external, internal };
}

/**
 * Extract code blocks from HTML content
 */
function extractCodeBlocks(htmlContent: string) {
  const codeBlockRegex = /<pre[^>]*><code[^>]*class="language-(\w+)"[^>]*>([\s\S]*?)<\/code><\/pre>/gi;
  const codeBlocks: Array<{ language: string; code: string }> = [];
  
  let match;
  while ((match = codeBlockRegex.exec(htmlContent)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].replace(/<[^>]*>/g, '').trim()
    });
  }
  
  return codeBlocks;
}

/**
 * Calculate word count from HTML content
 */
function calculateWordCount(htmlContent: string): number {
  const textContent = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return textContent ? textContent.split(/\s+/).length : 0;
}

/**
 * Calculate reading time in minutes
 */
function calculateReadingTime(htmlContent: string): number {
  const wordsPerMinute = 200;
  const wordCount = calculateWordCount(htmlContent);
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Generate table of contents from headings
 */
export function generateTableOfContents(htmlContent: string) {
  const headings = extractHeadings(htmlContent);
  
  if (headings.length === 0) {
    return null;
  }
  
  const tocItems = headings
    .filter(heading => heading.level >= 2 && heading.level <= 4) // Only h2, h3, h4
    .map(heading => ({
      id: heading.id,
      text: heading.text,
      level: heading.level,
      children: [] as any[]
    }));
  
  // Build nested structure
  const toc: any[] = [];
  const stack: any[] = [];
  
  for (const item of tocItems) {
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }
    
    if (stack.length === 0) {
      toc.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }
    
    stack.push(item);
  }
  
  return toc;
}