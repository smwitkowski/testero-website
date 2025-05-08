import React from 'react';
import Link from 'next/link';
import { faqData } from '@/lib/content/faqData';

export default function FaqPage() {
  return (
    <div>
      <p className="mb-8 text-lg text-gray-700">
        Welcome to our FAQ page. Here you will find answers to the most common questions
        about Testero. If you cannot find an answer to your question, please feel free
        to contact us.
      </p>
      <div className="space-y-6">
        {faqData.map((faq) => (
          <div key={faq.slug} className="p-6 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <Link href={`/faq/${faq.slug}`}>
              <h2 className="text-2xl font-semibold text-blue-700 hover:underline mb-2">
                {faq.question}
              </h2>
            </Link>
            <p className="text-gray-600">{faq.answerSnippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
