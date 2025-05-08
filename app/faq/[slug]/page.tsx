import React, { Suspense } from 'react';
import { faqData } from '@/lib/content/faqData';
import type { Metadata } from 'next'; // Remove PageProps import
import FaqClientContent from './FaqClientContent'; // Import the new Client Component

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { // Correct prop type
  const unwrappedParams = await params; // Await params
  const faq = faqData.find((f) => f.slug === unwrappedParams.slug);

  if (!faq) {
    return {
      title: 'FAQ Not Found',
      description: 'The FAQ you are looking for could not be found.',
    };
  }

  return {
    title: faq.question,
    description: faq.answer.substring(0, 160) + (faq.answer.length > 160 ? '...' : ''), // Truncate description
  };
}

export default async function FaqSlugPage({ params }: { params: Promise<{ slug: string }> }) { // Correct prop type and make async
  const unwrappedParams = await params; // Await params
  const faq = faqData.find((f) => f.slug === unwrappedParams.slug); // Find FAQ data on the server

  return (
    <Suspense fallback={<div>Loading FAQ...</div>}>
      <FaqClientContent faq={faq} /> {/* Pass FAQ data to Client Component */}
    </Suspense>
  );
}
