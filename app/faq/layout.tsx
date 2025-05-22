import { ReactNode } from 'react';
import { generateMetadata as generateSeoMetadata } from '@/lib/seo/seo';
// import Link from 'next/link'; // Removed unused import

export const metadata = generateSeoMetadata({
  title: 'Frequently Asked Questions | Testero',
  description: 'Find answers to common questions about Testero and Google Cloud certifications.',
  canonical: '/faq',
});

export default function FaqLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow">{children}</main> {/* Use main tag for content */}
      <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Need more help? 
          </p>
          <div className="mt-8 text-slate-500 dark:text-slate-500">
            <p>© {new Date().getFullYear()} Testero. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
