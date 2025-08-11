import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, FileText, BookOpen } from 'lucide-react';

export default function ContentNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Content Not Found
          </h1>
          <p className="text-xl text-gray-600">
            The content you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="bg-white rounded-lg p-8 shadow-sm border mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            What can you do?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-left">
              <div className="flex items-center space-x-3 mb-2">
                <Search className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium">Browse All Content</h3>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                Explore our comprehensive library of certification guides and resources.
              </p>
              <Link 
                href="/content" 
                className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View All Guides →
              </Link>
            </div>
            
            <div className="text-left">
              <div className="flex items-center space-x-3 mb-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium">Read Our Blog</h3>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                Get the latest insights on PMLE exam preparation and ML certification tips.
              </p>
              <Link 
                href="/blog" 
                className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Visit Blog →
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/content"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Content
          </Link>
          
          <Link 
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium"
          >
            Go to Homepage
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>
            If you believe this is an error, please{' '}
            <Link href="/contact" className="text-blue-600 hover:text-blue-800">
              contact our support team
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}