import { generateMetadata as baseGenerateMetadata, generateJsonLd } from "@/lib/seo";

// Generate metadata for the home page
export const generateMetadata = () => baseGenerateMetadata({
  title: "PMLE Exam Prep | Pass Google ML Certification - Testero",
  description: "Pass the PMLE exam with confidence. Updated for October 2024 changes. AI-powered practice questions, personalized study plans. Start free diagnostic.",
  keywords: [
    "PMLE exam", 
    "Professional Machine Learning Engineer", 
    "Google ML certification", 
    "PMLE practice questions", 
    "PMLE study guide", 
    "PMLE exam prep", 
    "Google cloud ML certification", 
    "Vertex AI exam questions", 
    "TensorFlow certification",
    "BigQuery ML exam",
    "MLOps certification",
    "PMLE October 2024",
    "PMLE pass rate",
    "PMLE exam cost",
    "machine learning engineer certification"
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
      "name": "PMLE Exam Prep | Pass Google ML Certification - Testero",
      "description": "Pass the PMLE exam with confidence. Updated for October 2024 changes. AI-powered practice questions, personalized study plans. Start free diagnostic.",
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": ["h1", "h2", ".hero-text"]
      },
      "mainEntity": {
        "@type": "Product",
        "name": "PMLE Pass",
        "description": "PMLE Pass: US$39 once for 90 days of full PMLE access. No automatic renewal.",
        "brand": {
          "@type": "Brand",
          "name": "Testero"
        },
        "offers": {
          "@type": "Offer",
          "availability": "https://schema.org/InStock",
          "price": "39",
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
            "text": "Testero is a PMLE exam preparation platform with realistic practice questions aligned to the current exam blueprint. Start with a free diagnostic to see your readiness, then upgrade for detailed explanations and unlimited practice."
          }
        },
        {
          "@type": "Question",
          "name": "What's included for free?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Free users get a PMLE diagnostic, a basic readiness summary with score and domain breakdown, and limited practice (5 questions per week). Explanations and unlimited practice require PMLE Pass."
          }
        },
        {
          "@type": "Question",
          "name": "How does billing work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "PMLE Pass costs US$39 once for 90 days of full access. There is no subscription or automatic renewal. Request a refund within 7 days of purchase; a refund ends pass access."
          }
        },
        {
          "@type": "Question",
          "name": "Is Testero affiliated with Google?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No — Testero is an independent exam preparation platform. We are not affiliated with Google or any certification body."
          }
        }
      ]
    }
  ]
});
