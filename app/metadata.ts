import { generateMetadata as baseGenerateMetadata, generateJsonLd } from "@/lib/seo";

// Generate metadata for the home page
export const generateMetadata = () => baseGenerateMetadata({
  title: "Testero | Ace Your Google Cloud, AWS, and Azure Certification Exams Confidently",
  description: "Testero is an AI-powered learning platform that generates always-current practice questions, builds personalized adaptive study plans, and accurately predicts exam readiness for Google Cloud, AWS, and Azure cloud certifications.",
  keywords: [
    "cloud certification exam", 
    "cloud certification preparation", 
    "Google Cloud certification", 
    "AWS certification", 
    "Azure certification", 
    "AI learning platform", 
    "cloud exam preparation", 
    "certification practice questions", 
    "adaptive cloud certification study plan",
    "exam readiness prediction",
    "GCP Professional Cloud Architect",
    "AWS Solutions Architect",
    "Azure Administrator",
    "cloud certification practice tests",
    "cloud certification study guide"
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
      "name": "Testero | Ace Your Google Cloud, AWS, and Azure Certification Exams Confidently",
      "description": "Testero is an AI-powered learning platform that generates always-current practice questions, builds personalized adaptive study plans, and accurately predicts exam readiness for Google Cloud, AWS, and Azure cloud certifications.",
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", "h2", ".hero-text"]
      },
      "mainEntity": {
        "@type": "Product",
        "name": "Testero AI Cloud Certification Platform",
        "description": "AI-powered cloud certification exam preparation platform for Google Cloud, AWS, and Azure",
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
            "text": "Testero is an AI-powered learning platform that helps professionals prepare for Google Cloud, AWS, and Azure certification exams with always-current practice questions, personalized adaptive study plans, and accurate exam readiness predictions."
          }
        },
        {
          "@type": "Question",
          "name": "Which cloud certification exams does Testero support?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Testero supports all major Google Cloud certifications (including Professional Cloud Architect, Associate Cloud Engineer), AWS certifications (including Solutions Architect, Developer), and Azure certifications (including Administrator, Developer), with plans to expand to additional technical certifications in the future."
          }
        },
        {
          "@type": "Question",
          "name": "How does Testero improve cloud certification exam preparation?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Testero uses AI to generate always-current practice questions that reflect the latest exam content, creates personalized study plans that focus on your weak areas, and accurately predicts when you'll be ready to pass your certification exam."
          }
        },
        {
          "@type": "Question",
          "name": "When will Testero be available for cloud certification preparation?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Testero is launching in private beta in July 2025. Join the waitlist today for priority access and a 30% lifetime discount on all cloud certification preparation materials."
          }
        }
      ]
    }
  ]
});
