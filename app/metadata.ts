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
        "name": "Testero PMLE Exam Preparation Platform",
        "description": "AI-powered PMLE (Professional Machine Learning Engineer) certification exam preparation with October 2024 updates",
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
          "name": "What is Testero's PMLE exam prep?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Testero is an AI-powered PMLE exam preparation platform with 200+ realistic practice questions updated for October 2024 exam changes. We offer a 7-day money-back guarantee - try Testero risk-free or get your money back."
          }
        },
        {
          "@type": "Question",
          "name": "Why is the PMLE exam so difficult?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The PMLE exam has a 70% fail rate because it tests deep ML knowledge across TensorFlow, Vertex AI, BigQuery ML, and MLOps. Google updated 30% of topics in October 2024, making outdated study materials dangerous. Most people waste $200 on failed attempts."
          }
        },
        {
          "@type": "Question",
          "name": "How does Testero guarantee PMLE success?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Our AI-powered system provides 200+ realistic PMLE-specific questions updated for October 2024 changes. Take our free diagnostic to see your exact readiness level, get personalized practice recommendations, and accelerate your preparation - or get your money back within 7 days."
          }
        },
        {
          "@type": "Question",
          "name": "What's included in Testero's PMLE prep?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The PMLE Readiness plan includes: unlimited PMLE practice questions, detailed explanations, free diagnostic test, personalized study plan, October 2024 exam updates, progress tracking, and our 7-day money-back guarantee. Plan starts at $39/month."
          }
        }
      ]
    }
  ]
});
