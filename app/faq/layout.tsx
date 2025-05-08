import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

// Placeholder for a simpler navigation if needed for FAQ, or reuse existing
// For now, let's assume a simple header or reuse ContentNavigation if appropriate
// import ContentNavigation from '@/components/content/ContentNavigation';

export const metadata: Metadata = {
  title: {
    template: '%s | FAQ | Testero',
    default: 'Frequently Asked Questions | Testero',
  },
  description: 'Find answers to common questions about Testero and our services.',
};

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* <ContentNavigation /> */}
      <header className="bg-gray-100 border-b">
        <div className="container mx-auto px-4 py-6">
          <Link href="/faq">
            <h1 className="text-3xl font-bold text-gray-800">Frequently Asked Questions</h1>
          </Link>
        </div>
      </header>
      <div className="flex-grow container mx-auto px-4 py-8">{children}</div>
      <footer className="bg-gray-50 border-t">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-gray-600">
            Need more help? <Link href="/contact" className="text-blue-600 hover:underline">Contact Us</Link>
          </p>
          <div className="mt-4 text-gray-500">
            <p>© {new Date().getFullYear()} Testero. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
