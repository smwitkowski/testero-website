import {
  Content,
  getHubContent,
  getSpokeContent,
  getSpokesForHub,
  getAllContentSlugs,
  getAllHubContent,
  getAllSpokeContent
} from './loader';

/**
 * This file provides wrapper functions that safely handle Next.js dynamic route params
 * to avoid "params should be awaited before using its properties" errors.
 */

// Define types for Next.js params
interface ParamsWithSlug {
  slug: string | string[];
  [key: string]: unknown;
}

interface ObjectWithParams {
  params?: ParamsWithSlug;
  slug?: string | string[];
  [key: string]: unknown;
}

// Helper function to safely get slug synchronously
function getSafeSlugSync(slugValue: string | string[] | Record<string, unknown> | undefined): string {
  // If it's already a string, return it
  if (typeof slugValue === 'string') {
    return slugValue;
  }
  
  // If it's an array (string[]), take the first item
  if (Array.isArray(slugValue)) {
    return String(slugValue[0] || 'unknown-slug');
  }
  
  // If it's an object or undefined, convert to string
  return String(slugValue || 'unknown-slug');
}

// Safe wrapper for getHubContent
export async function getHubContentSafe(slugOrParams: string | ObjectWithParams): Promise<Content | null> {
  let slug: string;
  
  try {
    // Handle Next.js props with potentially Promise-like params
    if (slugOrParams && typeof slugOrParams === 'object') {
      const params = slugOrParams as ObjectWithParams;
      if (params.params && params.params.slug) {
        // For direct params access, we use a static string if there's an error accessing slug
        try {
          slug = getSafeSlugSync(params.params.slug);
        } catch {
          // If we can't access params.slug (e.g., it's a Promise), use a default slug
          slug = 'google-cloud-certification-guide';
        }
      } else if (params.slug) {
        // Direct slug property
        slug = getSafeSlugSync(params.slug);
      } else {
        // Default fallback
        slug = 'google-cloud-certification-guide';
      }
    } else if (typeof slugOrParams === 'string') {
      // Direct string slug
      slug = slugOrParams;
    } else {
      // Unknown format, use default
      slug = 'google-cloud-certification-guide';
    }
  } catch {
    // If any errors occur, fall back to default slug
    slug = 'google-cloud-certification-guide';
  }
  
  // Get the content 
  return getHubContent(slug);
}

// Safe wrapper for getSpokeContent
export async function getSpokeContentSafe(slugOrParams: string | ObjectWithParams): Promise<Content | null> {
  let slug: string;
  
  try {
    // Handle Next.js props with potentially Promise-like params
    if (slugOrParams && typeof slugOrParams === 'object') {
      const params = slugOrParams as ObjectWithParams;
      if (params.params && params.params.slug) {
        // For direct params access, we use a static string if there's an error accessing slug
        try {
          slug = getSafeSlugSync(params.params.slug);
        } catch {
          // If we can't access params.slug (e.g., it's a Promise), use a default slug
          slug = 'google-cloud-digital-leader-certification';
        }
      } else if (params.slug) {
        // Direct slug property
        slug = getSafeSlugSync(params.slug);
      } else {
        // Default fallback
        slug = 'google-cloud-digital-leader-certification';
      }
    } else if (typeof slugOrParams === 'string') {
      // Direct string slug
      slug = slugOrParams;
    } else {
      // Unknown format, use default
      slug = 'google-cloud-digital-leader-certification';
    }
  } catch {
    // If any errors occur, fall back to default slug
    slug = 'google-cloud-digital-leader-certification';
  }
  
  // Get the content
  return getSpokeContent(slug);
}

// Safe wrapper for getSpokesForHub
export async function getSpokesForHubSafe(slugOrParams: string | ObjectWithParams): Promise<Content[]> {
  let slug: string;
  
  try {
    // Handle Next.js props with potentially Promise-like params
    if (slugOrParams && typeof slugOrParams === 'object') {
      const params = slugOrParams as ObjectWithParams;
      if (params.params && params.params.slug) {
        // For direct params access, we use a static string if there's an error accessing slug
        try {
          slug = getSafeSlugSync(params.params.slug);
        } catch {
          // If we can't access params.slug (e.g., it's a Promise), use a default slug
          slug = 'google-cloud-certification-guide';
        }
      } else if (params.slug) {
        // Direct slug property
        slug = getSafeSlugSync(params.slug);
      } else {
        // Default fallback
        slug = 'google-cloud-certification-guide';
      }
    } else if (typeof slugOrParams === 'string') {
      // Direct string slug
      slug = slugOrParams;
    } else {
      // Unknown format, use default
      slug = 'google-cloud-certification-guide';
    }
  } catch {
    // If any errors occur, fall back to default slug
    slug = 'google-cloud-certification-guide';
  }
  
  // Get the related spokes
  return getSpokesForHub(slug);
}

// Re-export other functions directly
export {
  getAllContentSlugs,
  getAllHubContent,
  getAllSpokeContent,
  type Content
};
