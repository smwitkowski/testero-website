import { generateMetadata as baseGenerateMetadata, generateJsonLd } from "@/lib/seo";

// Generate metadata for the home page
export const generateMetadata = () => baseGenerateMetadata({
  title: "Testero | Ace Your Cloud Certification Exams Confidently",
  description: "Testero is an AI-powered learning platform that generates always-current practice questions, builds adaptive study plans, and predicts exam readiness for Google Cloud, AWS, and Azure certifications.",
  keywords: [
    "certification exam", 
    "cloud certification", 
    "Google Cloud certification", 
    "AWS certification", 
    "Azure certification", 
    "AI learning platform", 
    "exam preparation", 
    "practice questions", 
    "adaptive study plan",
    "exam readiness prediction"
  ],
  canonical: "/",
});

// Generate JSON-LD structured data for the home page
export const getJsonLd = () => generateJsonLd({
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://testero.ai/#webpage",
      "url": "https://testero.ai",
      "name": "Testero | Ace Your Cloud Certification Exams Confidently",
      "description": "Testero is an AI-powered learning platform that generates always-current practice questions, builds adaptive study plans, and predicts exam readiness for Google Cloud, AWS, and Azure certifications.",
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", "h2", ".hero-text"]
      },
      "mainEntity": {
        "@type": "Product",
        "name": "Testero AI Learning Platform",
        "description": "AI-powered certification exam preparation platform",
        "brand": {
          "@type": "Brand",
          "name": "Testero"
        },
        "offers": {
          "@type": "Offer",
          "availability": "https://schema.org/PreOrder",
          "price": "0",
          "priceCurrency": "USD"
        }
      }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Testero?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Testero is an AI-powered learning platform that helps professionals prepare for cloud certification exams with always-current practice questions, adaptive study plans, and exam readiness predictions."
          }
        },
        {
          "@type": "Question",
          "name": "Which certification exams does Testero support?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Testero initially supports Google Cloud, AWS, and Azure certification exams, with plans to expand to additional technical certifications in the future."
          }
        },
        {
          "@type": "Question",
          "name": "When will Testero be available?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Testero is launching in private beta in July 2025. Join the waitlist today for priority access and a 30% lifetime discount."
          }
        }
      ]
    }
  ]
});
