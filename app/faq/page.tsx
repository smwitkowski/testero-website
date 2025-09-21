'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { faqData, FaqEntry } from '@/lib/content/faqData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Group FAQs by their pillar
const groupFaqsByPillar = () => {
  const groups: Record<string, FaqEntry[]> = {};
  faqData.forEach(faq => {
    if (!groups[faq.pillar]) {
      groups[faq.pillar] = [];
    }
    groups[faq.pillar].push(faq);
  });
  return groups;
};

export default function FaqPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [visibleFaqs, setVisibleFaqs] = useState(faqData);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const faqsByPillar = groupFaqsByPillar();
  const categories = ['All', ...Object.keys(faqsByPillar)];
  
  useEffect(() => {
    let filtered = faqData;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(faq => 
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
        faq.answerSnippet.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filter by category
    if (activeCategory !== 'All') {
      filtered = filtered.filter(faq => faq.pillar === activeCategory);
    }
    
    setVisibleFaqs(filtered);
  }, [searchTerm, activeCategory]);

  const handleSearchFocus = () => {
    if (searchInputRef.current) {
      searchInputRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 min-h-screen">
      <div className="container mx-auto px-4 py-20">
        {/* Hero section */}
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-50 dark:to-slate-300"
          >
            Questions? We&apos;ve Got You Covered
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto"
          >
            Everything you need to know about Testero and Google Cloud certifications
          </motion.p>
        </div>

        {/* Search and filter section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-10 max-w-2xl mx-auto"
        >
          <div className="relative mb-8">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for questions..."
              className="w-full px-6 py-4 rounded-full border-2 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg shadow-sm dark:bg-slate-800 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={handleSearchFocus}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map(category => (
              <Button
                key={category}
                size="sm"
                variant={activeCategory === category ? "solid" : "outline"}
                tone={activeCategory === category ? "accent" : "neutral"}
                className="rounded-full px-6"
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* FAQ cards */}
        {visibleFaqs.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <h3 className="text-2xl font-semibold mb-4 text-slate-700 dark:text-slate-300">No results found</h3>
            <p className="text-slate-600 dark:text-slate-400">Try adjusting your search or category filter</p>
          </motion.div>
        ) : (
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {visibleFaqs.map((faq) => (
              <motion.div key={faq.slug} variants={item}>
                <Link href={`/faq/${faq.slug}`} className="block h-full">
                  <Card className={cn(
                    "h-full overflow-hidden group hover:shadow-md transition-all duration-300 border-slate-200 dark:border-slate-700",
                    "dark:bg-slate-800/60 backdrop-blur-sm hover:scale-[1.02] hover:border-orange-200 dark:hover:border-orange-800",
                    "relative"
                  )}>
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-orange-400 to-orange-600"></div>
                    <CardContent className="p-6">
                      <div className="mb-1 text-xs font-medium text-orange-500 dark:text-orange-400 uppercase tracking-wider">
                        {faq.pillar}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {faq.question}
                      </h3>
                      <div className="text-slate-600 dark:text-slate-300">
                        {faq.answerSnippet}
                        <span className="text-orange-600 dark:text-orange-400 ml-1 inline-block group-hover:translate-x-1 transition-transform">→</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Contact section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-16 text-center py-10 px-8 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 shadow-sm"
        >
          <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Still have questions?</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-6">
            Our team is here to help. If you can&apos;t find the answer you&apos;re looking for, 
            don&apos;t hesitate to reach out to us directly.
          </p>
          <Button tone="accent" size="md" className="rounded-full px-6 shadow-sm">
            Contact Support
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
