import React, { Suspense } from 'react';
import { faqData } from '@/lib/content/faqData';
import type { Metadata } from 'next';
import FaqClientContent from './FaqClientContent';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://testero.ai';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const unwrappedParams = await params;
  const faq = faqData.find((f) => f.slug === unwrappedParams.slug);

  if (!faq) {
    return {
      title: 'FAQ Not Found',
      description: 'The FAQ you are looking for could not be found.',
    };
  }

  return {
    title: faq.question,
    description: faq.answer.substring(0, 160) + (faq.answer.length > 160 ? '...' : ''),
    alternates: {
      canonical: `${baseUrl}/faq/${faq.slug}`,
    },
  };
}

export default async function FaqSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const unwrappedParams = await params;
  const faq = faqData.find((f) => f.slug === unwrappedParams.slug);

  return (
    <Suspense fallback={<div>Loading FAQ...</div>}>
      <FaqClientContent faq={faq} />
    </Suspense>
  );
}
