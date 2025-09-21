'use client';

import React from 'react';
import Link from 'next/link';
import { FaqEntry } from '@/lib/content/faqData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface FaqClientContentProps {
  faq: FaqEntry | undefined;
}

export default function FaqClientContent({ faq }: FaqClientContentProps) {
  if (!faq) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 min-h-screen">
        <div className="container mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900 dark:text-slate-50">
              FAQ Not Found
            </h1>
            <p className="mb-8 text-lg text-slate-700 dark:text-slate-300">
              Sorry, we could not find the FAQ you were looking for.
            </p>
            <Button
              asChild
              variant="outline"
              tone="accent"
              size="sm"
              className="rounded-full hover:scale-105 transition-transform"
            >
              <Link href="/faq">
                &larr; Back to FAQs
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Helper to render markdown-like content safely
  // In a real app, use a proper markdown renderer like react-markdown
  const renderAnswer = (answer: string) => {
    return answer.split('\n').map((paragraph, index) => (
      <motion.p 
        key={index} 
        className="mb-6 last:mb-0 text-lg leading-relaxed"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
      >
        {paragraph}
      </motion.p>
    ));
  };

  // Extract cost from data points if available
  const costInfo = faq.data_points.cost_usd ? `$${faq.data_points.cost_usd} USD` : null;
  const examLength = faq.data_points.exam_length_minutes ? `${faq.data_points.exam_length_minutes} minutes` : null;
  const passingScore = faq.data_points.passing_score_pct ? `${faq.data_points.passing_score_pct}%` : null;

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 min-h-screen">
      <div className="container mx-auto px-4 py-20">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [{
                "@type": "Question",
                "name": faq.question,
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": faq.answer
                }
              }]
            })
          }}
        />
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <Button asChild variant="ghost" tone="neutral" size="sm" className="mb-6 group">
            <Link href="/faq">
              <span className="inline-block mr-1 group-hover:-translate-x-1 transition-transform">←</span> Back to FAQs
            </Link>
          </Button>
          
          <div className="mb-1 text-sm font-medium text-orange-500 dark:text-orange-400 uppercase tracking-wider">
            {faq.pillar}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-slate-900 dark:text-white">
            {faq.question}
          </h1>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main content */}
          <motion.div 
            className="lg:col-span-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card
              size="lg"
              inset="content"
              className="overflow-hidden border-0 shadow-xl bg-white dark:bg-slate-800/80 backdrop-blur-sm"
            >
              <CardContent className="relative gap-0 px-section_md py-section_md md:px-section_md md:py-section_md">
                <div className="prose prose-lg max-w-none dark:prose-invert">
                  {renderAnswer(faq.answer)}
                </div>
                
                {/* Citations */}
                {faq.citations && faq.citations.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700"
                  >
                    <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200">Sources</h3>
                    <ul className="space-y-2">
                      {faq.citations.map((citation, index) => (
                        <li key={index} className="text-sm text-slate-600 dark:text-slate-400 truncate">
                          <a 
                            href={citation} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                          >
                            {citation}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Sidebar with data points */}
          <motion.div 
            className="lg:col-span-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="sticky top-10">
              <Card
                size="lg"
                className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-slate-800 dark:to-slate-700 border-0 shadow-lg overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-200 dark:bg-orange-800/20 rounded-full -mr-12 -mt-12 opacity-50"></div>
                <CardContent className="relative">
                  <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Quick Facts</h3>
                  
                  <div className="space-y-4">
                    {costInfo && (
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-3 w-10 h-10 flex items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800/30">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-orange-700 dark:text-orange-300">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Cost</div>
                          <div className="font-semibold text-slate-900 dark:text-white">{costInfo}</div>
                        </div>
                      </div>
                    )}
                    
                    {examLength && (
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-3 w-10 h-10 flex items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800/30">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-orange-700 dark:text-orange-300">
                            <circle cx="12" cy="12" r="10" strokeWidth="2" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Exam Duration</div>
                          <div className="font-semibold text-slate-900 dark:text-white">{examLength}</div>
                        </div>
                      </div>
                    )}
                    
                    {passingScore && (
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-3 w-10 h-10 flex items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800/30">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-orange-700 dark:text-orange-300">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Passing Score</div>
                          <div className="font-semibold text-slate-900 dark:text-white">{passingScore}</div>
                        </div>
                      </div>
                    )}
                    
                    {(faq.data_points.search_volume_us > 0) && (
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-3 w-10 h-10 flex items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800/30">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-orange-700 dark:text-orange-300">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Popularity</div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {faq.data_points.search_volume_us > 5000 ? 'High' : faq.data_points.search_volume_us > 1000 ? 'Medium' : 'Low'} search interest
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Link 
                    href={faq.internal_link.replace('.md', '')} 
                    className="mt-8 block w-full text-center py-3 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
                  >
                    Read Full Guide
                  </Link>
                </CardContent>
              </Card>
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3 text-slate-900 dark:text-white">Share this FAQ</h3>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    tone="neutral"
                    size="sm"
                    className="size-10 rounded-full p-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.006-.422A6.685 6.685 0 0 0 16 3.542a6.658 6.658 0 0 1-1.889.518 3.301 3.301 0 0 0 1.447-1.817 6.533 6.533 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.325 9.325 0 0 1-6.767-3.429 3.289 3.289 0 0 0 1.018 4.382A3.323 3.323 0 0 1 .64 6.575v.045a3.288 3.288 0 0 0 2.632 3.218 3.203 3.203 0 0 1-.865.115 3.23 3.23 0 0 1-.614-.057 3.283 3.283 0 0 0 3.067 2.277A6.588 6.588 0 0 1 .78 13.58a6.32 6.32 0 0 1-.78-.045A9.344 9.344 0 0 0 5.026 15z"/>
                    </svg>
                  </Button>
                  <Button
                    variant="outline"
                    tone="neutral"
                    size="sm"
                    className="size-10 rounded-full p-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z"/>
                    </svg>
                  </Button>
                  <Button
                    variant="outline"
                    tone="neutral"
                    size="sm"
                    className="size-10 rounded-full p-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
