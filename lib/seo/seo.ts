import type { Metadata, Viewport } from "next";

// Define image URL types
type ImageUrls = {
  ogImage: {
    jpg: string;
    webp: string;
  };
  twitterImage: {
    jpg: string;
    webp: string;
  };
  logo: {
    png: string;
    webp: string;
  };
};

// Default CDN image URLs
// In a production environment, these would be loaded from a configuration
// or fetched from an API endpoint
const cdnImageUrls: ImageUrls = {
  ogImage: {
    jpg: "/og-image.jpg",
    webp: "/og-image.webp"
  },
  twitterImage: {
    jpg: "/twitter-image.jpg",
    webp: "/twitter-image.webp"
  },
  logo: {
    png: "/logo.png",
    webp: "/logo.webp"
  }
};

type SeoProps = {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  twitterImage?: string;
  noIndex?: boolean;
  canonical?: string;
  useCdn?: boolean;
};

/**
 * Generates customizable SEO metadata for Next.js pages
 * 
 * @param props - SEO properties to customize
 * @returns Metadata object for Next.js
 */
export function generateMetadata(props: SeoProps = {}): Metadata {
  const {
    title = "Testero | AI-Powered Certification Exam Preparation",
    description = "Testero helps you ace Google Cloud, AWS, and Azure certification exams with AI-generated practice questions, adaptive study plans, and exam readiness predictions.",
    keywords = [
      "certification exam", 
      "cloud certification", 
      "Google Cloud", 
      "AWS", 
      "Azure", 
      "AI learning", 
      "exam preparation", 
      "practice questions", 
      "study plan"
    ],
    ogImage = "/og-image.jpg",
    twitterImage = "/twitter-image.jpg",
    noIndex = false,
    canonical = "/",
    useCdn = true,
  } = props;

  // Use CDN URLs if available and enabled
  const finalOgImage = (useCdn && cdnImageUrls?.ogImage?.jpg) || ogImage;
  const finalTwitterImage = (useCdn && cdnImageUrls?.twitterImage?.jpg) || twitterImage;

  return {
    metadataBase: new URL("https://testero.ai"),
    title,
    description,
    keywords,
    authors: [{ name: "Testero Team" }],
    creator: "Testero AI",
    publisher: "Testero AI",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    alternates: {
      canonical,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: `https://testero.ai${canonical}`,
      siteName: "Testero",
      title,
      description,
      images: [
        {
          url: finalOgImage,
          width: 1200,
          height: 630,
          alt: "Testero - AI-Powered Certification Exam Preparation",
          // Add WebP version if available
          ...(useCdn && cdnImageUrls?.ogImage?.webp && {
            secureUrl: cdnImageUrls.ogImage.webp,
          }),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [finalTwitterImage],
      creator: "@testero_ai",
    },
  };
}

/**
 * Generates viewport configuration for Next.js pages
 * 
 * @returns Viewport object for Next.js
 */
export function generateViewport(): Viewport {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  };
}

/**
 * Generates JSON-LD structured data for SEO
 * 
 * @param customData - Optional custom data to merge with default structured data
 * @param useCdn - Whether to use CDN URLs for images
 * @returns JSON-LD structured data as a string
 */
export function generateJsonLd(
  customData: Record<string, unknown> = {}, 
  useCdn: boolean = true
): string {
  // Use CDN URL for logo if available and enabled
  const logoUrl = (useCdn && cdnImageUrls?.logo?.png) || "https://testero.ai/logo.png";
  
  const defaultData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://testero.ai/#organization",
        "name": "Testero AI",
        "url": "https://testero.ai",
        "logo": {
          "@type": "ImageObject",
          "@id": "https://testero.ai/#logo",
          "inLanguage": "en-US",
          "url": logoUrl,
          "contentUrl": logoUrl,
          "width": 512,
          "height": 512,
          "caption": "Testero AI"
        },
        "image": { "@id": "https://testero.ai/#logo" }
      },
      {
        "@type": "WebSite",
        "@id": "https://testero.ai/#website",
        "url": "https://testero.ai",
        "name": "Testero",
        "description": "AI-Powered Certification Exam Preparation",
        "publisher": { "@id": "https://testero.ai/#organization" },
        "inLanguage": "en-US"
      },
      {
        "@type": "WebPage",
        "@id": "https://testero.ai/#webpage",
        "url": "https://testero.ai",
        "name": "Testero | AI-Powered Certification Exam Preparation",
        "isPartOf": { "@id": "https://testero.ai/#website" },
        "about": { "@id": "https://testero.ai/#organization" },
        "description": "Testero helps you ace Google Cloud, AWS, and Azure certification exams with AI-generated practice questions, adaptive study plans, and exam readiness predictions.",
        "inLanguage": "en-US",
        "potentialAction": [
          {
            "@type": "ReadAction",
            "target": ["https://testero.ai"]
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "name": "Testero",
        "operatingSystem": "Web",
        "applicationCategory": "EducationalApplication",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/ComingSoon"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "ratingCount": "1200",
          "bestRating": "5",
          "worstRating": "1"
        }
      }
    ]
  };

  // Deep merge custom data with default data
  const mergedData = deepMerge(defaultData, customData);
  
  return JSON.stringify(mergedData);
}

/**
 * Deep merges two objects
 * 
 * @param target - Target object
 * @param source - Source object to merge into target
 * @returns Merged object
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(
            target[key] as Record<string, unknown>, 
            source[key] as Record<string, unknown>
          );
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Checks if value is an object
 * 
 * @param item - Value to check
 * @returns Whether the value is an object
 */
function isObject(item: unknown): boolean {
  return (item !== null && typeof item === 'object' && !Array.isArray(item));
}
