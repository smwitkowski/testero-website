'use client';

import React from 'react';
import Link from 'next/link';
import { FaqEntry } from '@/lib/content/faqData'; // Assuming FaqEntry is exported

interface FaqClientContentProps {
  faq: FaqEntry | undefined;
}

export default function FaqClientContent({ faq }: FaqClientContentProps) {
  if (!faq) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">FAQ Not Found</h1>
        <p>Sorry, we could not find the FAQ you were looking for.</p>
        <Link href="/faq" className="text-blue-600 hover:underline mt-4 inline-block">
          &larr; Back to FAQs
        </Link>
      </div>
    );
  }

  return (
    <article className="prose lg:prose-xl max-w-none">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [{
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
              }
            }]
          })
        }}
      />
      <h1 className="text-3xl font-bold mb-6 text-gray-800">{faq.question}</h1>
      <div className="text-gray-700 leading-relaxed">
        <p>{faq.answer}</p>
      </div>
      <div className="mt-8 pt-6 border-t border-gray-200">
        <Link href="/faq" className="text-blue-600 hover:underline">
          &larr; Back to All FAQs
        </Link>
      </div>
    </article>
  );
}
