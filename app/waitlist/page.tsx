"use client";

import React from 'react';
import Link from 'next/link';
import { usePostHog } from "posthog-js/react";
import { WaitlistForm } from "@/components/marketing/forms/waitlist-form";
import { motion } from "framer-motion";

const WaitlistPage = () => {
  const posthog = usePostHog(); // Get PostHog instance

  // Track page view in PostHog
  React.useEffect(() => {
    if (posthog) {
      posthog.capture('waitlist_page_viewed');
    }
  }, [posthog]);

  return (
    <div className="min-h-screen pt-24 pb-12 md:pt-32 flex flex-col items-center justify-start bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-2xl px-6">
        {/* Card Container */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white shadow-lg rounded-xl border border-slate-200 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 md:px-10 py-8 md:py-10 text-center border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">Join the Testero Waitlist</h1>
            <p className="text-slate-600 md:text-lg max-w-xl mx-auto">
              Get early access to our AI-powered learning platform for cloud certification exams. Sign up now to secure your spot and a <span className="font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded">30% lifetime discount</span>.
            </p>
          </div>

          {/* Form Container */}
          <div className="px-6 md:px-10 py-8 md:py-10">
            <div className="max-w-md mx-auto">
              <div className="grid gap-8">
                {/* Benefits List */}
                <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                  <h3 className="font-semibold text-blue-800 mb-3 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Waitlist Benefits
                  </h3>
                  <ul className="space-y-2 text-blue-700">
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Priority access to our beta launch (July 2025)</span>
                    </li>
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>30% lifetime discount on PMLE Readiness subscription</span>
                    </li>
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Opportunity to provide feedback and shape the platform</span>
                    </li>
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Early access to new features and updates</span>
                    </li>
                  </ul>
                </div>

                {/* Waitlist Form */}
                <div>
                  <h3 className="font-medium text-slate-700 mb-3 text-center">Enter your email to secure your spot:</h3>
                  <WaitlistForm 
                    buttonText="Join the Waitlist" 
                    ctaLocation="waitlist_page" 
                    includeExamDropdown={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* FAQ Preview */}
        <div className="mt-10 text-center">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Frequently Asked Questions</h2>
          <div className="bg-white p-5 rounded-lg shadow-md border border-slate-200 mb-6">
            <h3 className="font-medium text-slate-700 mb-2">When will Testero launch?</h3>
            <p className="text-slate-600">Testero will be launched as a private beta in July 2025, with priority access for waitlist members. The public launch is scheduled for Q4 2025.</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-md border border-slate-200 mb-6">
            <h3 className="font-medium text-slate-700 mb-2">Which certification exams will be supported?</h3>
            <p className="text-slate-600">At launch, we&apos;ll support Google Cloud (GCP), AWS, and Microsoft Azure certification exams, with more platforms being added based on user demand.</p>
          </div>
          <Link 
            href="/faq" 
            className="text-orange-500 hover:text-orange-600 transition-colors font-medium flex items-center justify-center"
          >
            <span>View all FAQs</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Already have an account link */}
        <div className="mt-8 text-center">
          <p className="text-slate-600">
            Already have an account?{' '}
            <Link 
              href="/login" 
              className="text-orange-500 hover:text-orange-600 transition-colors font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Visual Decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-blue-500 mix-blend-multiply blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-orange-500 mix-blend-multiply blur-3xl"></div>
      </div>
    </div>
  );
};

export default WaitlistPage;
