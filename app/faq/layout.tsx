import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { cn } from '@/lib/utils'; // Import cn utility
import { Button } from '@/components/ui/button'; // Import Button component

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
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center">
            {/* Replace with your logo component or image */}
            <span className="text-2xl font-bold text-slate-900 dark:text-white">Testero</span>
          </Link>
          <nav>
            <ul className="flex space-x-4">
              <li>
                <Link href="/faq" className="text-slate-600 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
                  FAQs
                </Link>
              </li>
              {/* Add other navigation links as needed */}
            </ul>
          </nav>
        </div>
      </header>
      <main className="flex-grow">{children}</main> {/* Use main tag for content */}
      <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Need more help? 
          </p>
          <Button asChild variant="outline" className="rounded-full hover:scale-105 transition-transform">
             <Link href="/contact">Contact Us</Link>
          </Button>
          <div className="mt-8 text-slate-500 dark:text-slate-500">
            <p>© {new Date().getFullYear()} Testero. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
