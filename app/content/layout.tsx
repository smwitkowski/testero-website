import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | Testero',
    default: 'Google Certification Resources | Testero',
  },
  description: 'Comprehensive guides and resources for Google cloud certifications to accelerate your tech career.',
  openGraph: {
    type: 'website',
    siteName: 'Testero',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@testero',
  },
};

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation breadcrumb */}
      <nav className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600">
              Home
            </Link>
            <span>/</span>
            <Link href="/content" className="hover:text-blue-600">
              Resources
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-grow">{children}</main>
      
      <footer className="bg-gray-50 border-t mt-16">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <Link href="/" className="inline-block mb-4">
                <h3 className="text-lg font-bold">Testero</h3>
              </Link>
              <p className="text-gray-600 leading-relaxed">
                Helping professionals master Google Cloud certifications and advance their careers with comprehensive guides, practice exams, and study resources.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Content</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/content" className="text-gray-600 hover:text-blue-600 transition-colors">
                    Certification Guides
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-gray-600 hover:text-blue-600 transition-colors">
                    PMLE Blog
                  </Link>
                </li>
                <li>
                  <Link href="/diagnostic" className="text-gray-600 hover:text-blue-600 transition-colors">
                    Practice Diagnostic
                  </Link>
                </li>
                <li>
                  <Link href="/study-path" className="text-gray-600 hover:text-blue-600 transition-colors">
                    Study Plans
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Platform</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 transition-colors">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-gray-600 hover:text-blue-600 transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="text-gray-600 hover:text-blue-600 transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-900">Company</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/about" className="text-gray-600 hover:text-blue-600 transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-gray-600 hover:text-blue-600 transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-gray-600 hover:text-blue-600 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-gray-600 hover:text-blue-600 transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-gray-500 text-sm">
                © {new Date().getFullYear()} Testero. All rights reserved.
              </p>
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <Link href="/sitemap.xml" className="hover:text-blue-600">
                  Sitemap
                </Link>
                <Link href="/robots.txt" className="hover:text-blue-600">
                  Robots
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
