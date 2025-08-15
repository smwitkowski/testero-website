import type { Metadata } from "next";

const title = "Testero Beta - What's Included | Early Access Program";
const description = "Join the Testero Beta and get exclusive early access to our AI-powered PMLE exam preparation platform. See exactly what you'll get, our current limitations, and how to get started.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "Testero beta",
    "PMLE exam preparation",
    "Google Cloud ML Engineer",
    "beta testing",
    "early access",
    "machine learning certification",
    "beta program",
    "AI-powered learning"
  ],
  authors: [{ name: "Testero" }],
  creator: "Testero",
  publisher: "Testero",
  alternates: {
    canonical: "/beta",
  },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "en_US",
    url: "/beta",
    siteName: "Testero",
    images: [
      {
        url: "/images/beta-og.jpg",
        width: 1200,
        height: 630,
        alt: "Testero Beta Program - Early Access to PMLE Exam Preparation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/beta-twitter.jpg"],
    creator: "@testero",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "google-site-verification-code",
  },
};

// JSON-LD structured data for beta program
export function JsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": title,
    "description": description,
    "url": "https://testero.com/beta",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Testero",
      "url": "https://testero.com"
    },
    "about": {
      "@type": "SoftwareApplication",
      "name": "Testero Beta",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web Browser",
      "description": "AI-powered preparation platform for Google Cloud Professional Machine Learning Engineer certification",
      "offers": {
        "@type": "Offer",
        "category": "Beta Testing Program",
        "availability": "https://schema.org/LimitedAvailability",
        "eligibility": "Beta participants only"
      }
    },
    "mainEntity": {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What do I get in the Testero Beta?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Full access to core features including diagnostic assessment, personalized study plan, question bank access, and progress tracking, plus beta-only perks like direct feedback loop and founder support."
          }
        },
        {
          "@type": "Question", 
          "name": "What are the current limitations?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The beta currently has partial coverage (17% of questions), mocked recommendations, missing analytics, and possible bugs as we're actively developing the platform."
          }
        },
        {
          "@type": "Question",
          "name": "How do I get started?",
          "acceptedAnswer": {
            "@type": "Answer", 
            "text": "Click your invite link, sign in or create an account, start the 15-20 minute diagnostic assessment, and review your results to begin your personalized study journey."
          }
        }
      ]
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}