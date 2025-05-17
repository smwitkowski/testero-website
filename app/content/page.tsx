import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { getAllHubContent, Content } from '@/lib/content/loader';

export const metadata: Metadata = {
  title: 'Google Certification Guides | Testero',
  description: 'Comprehensive guides for Google certifications to accelerate your career in cloud, data analytics, machine learning, and more.',
  openGraph: {
    title: 'Google Certification Guides | Testero',
    description: 'Comprehensive guides for Google certifications to accelerate your career in cloud, data analytics, machine learning, and more.',
    url: 'https://testero.ai/content',
    siteName: 'Testero',
    locale: 'en_US',
    type: 'website',
  },
  alternates: {
    canonical: '/content',
  },
};

type HubCardProps = {
  content: Content;
};

const HubCard = ({ content }: HubCardProps) => {
  const { meta } = content;
  
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {meta.coverImage && (
        <div className="relative h-48 w-full">
          <Image 
            src={meta.coverImage} 
            alt={meta.title} 
            fill 
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      )}
      <div className="p-6">
        <Link href={`/content/hub/${meta.slug}`} className="block hover:underline">
          <h2 className="text-2xl font-bold mb-2">{meta.title}</h2>
        </Link>
        <p className="text-gray-700 mb-4">
          {meta.description.length > 160 
            ? `${meta.description.substring(0, 160)}...` 
            : meta.description}
        </p>
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>
            {new Date(meta.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          {meta.readingTime && (
            <span>{meta.readingTime} min read</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default async function ContentPage() {
  const hubContent = await getAllHubContent();
  
  return (
    <main className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Google Certification Resources
          </h1>
          <p className="text-xl text-gray-700">
            Comprehensive guides to help you navigate Google&apos;s professional certification ecosystem
          </p>
        </div>
        
        {hubContent.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No content available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hubContent.map((content) => (
              <HubCard key={content.slug} content={content} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
