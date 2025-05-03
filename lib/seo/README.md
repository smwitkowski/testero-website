# Testero SEO Implementation

This directory contains the SEO implementation for the Testero website. It provides utilities for generating metadata, viewport configuration, and JSON-LD structured data for better search engine visibility and social media sharing.

## Features

- **Comprehensive Metadata**: Title, description, Open Graph, Twitter Cards, canonical URLs, etc.
- **Viewport Configuration**: Responsive design settings for different devices
- **JSON-LD Structured Data**: Organization, WebSite, WebPage, and SoftwareApplication schemas
- **Social Media Optimization**: Customized images for social sharing
- **Dynamic Sitemap Generation**: Automatically generates sitemap.xml based on pages
- **Customizable per Page**: Each page can have its own metadata and structured data

## Usage

### Basic Usage

In your layout or page file:

```tsx
import { generateMetadata, generateViewport } from "@/lib/seo";

// Generate default metadata
export const metadata = generateMetadata();

// Generate viewport configuration
export const viewport = generateViewport();
```

### Custom Metadata

To customize metadata for a specific page:

```tsx
import { generateMetadata } from "@/lib/seo";

// Generate custom metadata
export const metadata = generateMetadata({
  title: "Custom Page Title | Testero",
  description: "Custom page description for better SEO.",
  keywords: ["custom", "keywords", "here"],
  canonical: "/custom-page",
  noIndex: false, // Set to true to prevent indexing
});
```

### Viewport Configuration

For responsive design settings:

```tsx
import { generateViewport } from "@/lib/seo";

// Generate default viewport configuration
export const viewport = generateViewport();

// Or customize it directly
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 2,
  userScalable: true,
};
```

### JSON-LD Structured Data

For adding structured data to a page:

```tsx
import { generateJsonLd } from "@/lib/seo";
import Script from "next/script";

// In your component
<Script
  id="json-ld"
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: generateJsonLd({
      // Custom structured data here
    })
  }}
/>
```

### Custom JSON-LD for Specific Pages

For pages with specific structured data needs:

```tsx
import { generateJsonLd } from "@/lib/seo";

// Generate custom JSON-LD
const jsonLd = generateJsonLd({
  "@graph": [
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Testero?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Testero is an AI-powered learning platform..."
          }
        }
      ]
    }
  ]
});
```

## Social Media Images

The project includes scripts to generate optimized images for social sharing:

- `og-image.jpg`: Open Graph image (1200x630)
- `twitter-image.jpg`: Twitter Card image (1200x630)
- `logo.png`: Logo image (512x512)

To regenerate these images:

```bash
npm run generate:social-images
```

## Sitemap Generation

The sitemap is automatically generated based on the pages in the `app` directory:

```bash
npm run generate:sitemap
```

This creates/updates `public/sitemap.xml` with all the pages in the application.

## Build Process

The SEO assets (sitemap and social images) are automatically generated during the build process through the `prebuild` script:

```bash
npm run build
```

## SEO Best Practices

1. **Page-Specific Metadata**: Each page should have unique, descriptive metadata
2. **Structured Data**: Use appropriate schema.org types for each page
3. **Canonical URLs**: Always specify canonical URLs to prevent duplicate content issues
4. **Social Media Optimization**: Ensure social sharing metadata and images are optimized
5. **Semantic HTML**: Use proper heading hierarchy and semantic HTML elements

## Files

- `lib/seo/seo.ts`: Core SEO utilities for metadata, viewport, and JSON-LD generation
- `lib/seo/index.ts`: Exports from the SEO module
- `lib/seo/README.md`: Documentation for the SEO implementation
- `app/metadata.ts`: Home page specific metadata configuration
- `app/page.metadata.tsx`: Home page metadata and JSON-LD exports
- `public/robots.txt`: Instructions for search engine crawlers
- `public/sitemap.xml`: XML sitemap for search engines
- `public/og-image.jpg`: Open Graph image for social sharing
- `public/twitter-image.jpg`: Twitter Card image for social sharing
- `public/logo.png`: Logo image for structured data
- `scripts/generate-sitemap.js`: Script to generate the sitemap
- `scripts/generate-social-images.js`: Script to generate social sharing images
