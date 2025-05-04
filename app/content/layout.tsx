import React from 'react';
import Link from 'next/link';
import ContentNavigation from '@/components/content/ContentNavigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | Testero',
    default: 'Google Certification Resources | Testero',
  },
  description: 'Comprehensive guides and resources for Google cloud certifications to accelerate your tech career.',
};

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <ContentNavigation />
      <div className="flex-grow">{children}</div>
      <footer className="bg-gray-50 border-t">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">Testero</h3>
              <p className="text-gray-600">
                Helping professionals master Google Cloud certifications and advance their careers.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-3">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/content" className="text-gray-600 hover:text-blue-600">
                    Certification Guides
                  </Link>
                </li>
                <li>
                  <Link href="/" className="text-gray-600 hover:text-blue-600">
                    Practice Exams
                  </Link>
                </li>
                <li>
                  <Link href="/" className="text-gray-600 hover:text-blue-600">
                    Study Plans
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Company</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/" className="text-gray-600 hover:text-blue-600">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/" className="text-gray-600 hover:text-blue-600">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/" className="text-gray-600 hover:text-blue-600">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/" className="text-gray-600 hover:text-blue-600">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/" className="text-gray-600 hover:text-blue-600">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-gray-500">
            <p>© {new Date().getFullYear()} Testero. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
