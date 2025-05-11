import { Metadata } from 'next';
import { Content } from './loader';

/**
 * Generate SEO metadata for content pages
 */
export function generateContentMetadata(content: Content): Metadata {
  const { meta } = content;
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://testero.ai';
  const imageUrl = meta.coverImage 
    ? `${baseUrl}${meta.coverImage}` 
    : `${baseUrl}/og-image.jpg`;

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: 'article',
      url: `${baseUrl}/${meta.type === 'hub' ? 'hub' : 'content'}/${meta.slug}`,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: meta.title,
        },
      ],
      publishedTime: meta.date,
      modifiedTime: meta.lastModified,
      authors: meta.author ? [meta.author] : undefined,
      tags: meta.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: [imageUrl],
    },
  };
}

/**
 * Types for JSON-LD structured data
 */
interface StructuredDataPerson {
  '@type': 'Person';
  name: string;
}

interface StructuredDataImageObject {
  '@type': 'ImageObject';
  url: string;
}

interface StructuredDataOrganization {
  '@type': 'Organization';
  name: string;
  logo: StructuredDataImageObject;
}

interface StructuredDataWebPage {
  '@type': 'WebPage';
  '@id': string;
}

interface StructuredDataArticle {
  '@context': 'https://schema.org';
  '@type': 'Article';
  headline: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified: string;
  author?: StructuredDataPerson;
  publisher: StructuredDataOrganization;
  mainEntityOfPage: StructuredDataWebPage;
}

/**
 * Generate structured data for content pages (JSON-LD)
 */
export function generateStructuredData(content: Content): StructuredDataArticle {
  const { meta } = content;
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://testero.ai';
  const contentUrl = `${baseUrl}/${meta.type === 'hub' ? 'hub' : 'content'}/${meta.slug}`;
  const imageUrl = meta.coverImage 
    ? `${baseUrl}${meta.coverImage}` 
    : `${baseUrl}/og-image.jpg`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description,
    image: imageUrl,
    datePublished: meta.date,
    dateModified: meta.lastModified || meta.date,
    author: meta.author ? {
      '@type': 'Person',
      name: meta.author,
    } : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Testero',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': contentUrl,
    },
  };
}
