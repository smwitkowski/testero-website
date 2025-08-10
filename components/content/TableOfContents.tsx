'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  contentId?: string;
  content?: string; // For parsing headings from HTML content
  className?: string;
}

function TableOfContents({ contentId, content, className = '' }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    let contentElement: Element | null = null;
    
    if (contentId) {
      contentElement = document.getElementById(contentId);
    } else if (content) {
      // Find the main content area or article element
      contentElement = document.querySelector('article') || document.querySelector('.blog-content') || document.querySelector('main');
    } else {
      contentElement = document.querySelector('article') || document.querySelector('.blog-content') || document.querySelector('main');
    }
    
    if (!contentElement) return;

    // Extract all headings from h2 to h4
    const elements = Array.from(contentElement.querySelectorAll('h2, h3, h4'));
    
    const headingsData = elements.map((element) => {
      // Make sure all headings have IDs for scrolling
      if (!element.id) {
        const id = element.textContent
          ?.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, '-') || `heading-${Math.random().toString(36).substr(2, 9)}`;
        element.id = id;
      }
      
      return {
        id: element.id,
        text: element.textContent || '',
        level: parseInt(element.tagName.substring(1)),
      };
    });
    
    setHeadings(headingsData);
    
    // Setup intersection observer for active heading highlighting
    const callback = (entries: IntersectionObserverEntry[]) => {
      // Find the first heading that is in view
      const visible = entries.filter(entry => entry.isIntersecting);
      if (visible.length > 0) {
        setActiveId(visible[0].target.id);
      }
    };
    
    const observer = new IntersectionObserver(callback, {
      rootMargin: '0px 0px -80% 0px',
    });
    
    elements.forEach(element => observer.observe(element));
    
    return () => observer.disconnect();
  }, [contentId, content]);
  
  if (headings.length === 0) return null;
  
  return (
    <nav className={`${className}`}>
      <h3 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">Table of Contents</h3>
      <ul className="space-y-1">
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={`${
              heading.level === 2 
                ? 'mb-2' 
                : heading.level === 3 
                  ? 'ml-3 mb-1' 
                  : 'ml-6 text-sm'
            }`}
          >
            <Link
              href={`#${heading.id}`}
              className={`
                block py-1.5 pl-3 rounded-md transition-all duration-200
                ${heading.level === 2 ? 'font-medium' : ''}
                ${activeId === heading.id
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium'
                  : 'border-l-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                }
              `}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(heading.id)?.scrollIntoView({
                  behavior: 'smooth',
                });
                setActiveId(heading.id); // Immediately set active for better feedback
              }}
            >
              <span className={`${heading.level > 2 ? 'text-sm' : ''}`}>
                {heading.text}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Export both default and named
export default TableOfContents;
export { TableOfContents };
