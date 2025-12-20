'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TableOfContentsProps, Heading } from './types';

function TableOfContents({ 
  contentId, 
  content, 
  className = '',
  headingLevels = [2, 3, 4],
  showNumbers = false,
  sticky = false,
  observerOptions = {}
}: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const processedRef = useRef<string>(''); // Track processed content to avoid reprocessing
  const headingsRef = useRef<Heading[]>([]); // Track current headings to avoid unnecessary updates
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Create stable keys for dependencies
  const contentKey = contentId || (typeof content === 'string' ? content.substring(0, 200) : String(content));
  const headingLevelsKey = headingLevels.join(',');
  const observerOptionsKey = JSON.stringify(observerOptions);

  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    let contentElement: Element | null = null;
    
    if (contentId) {
      contentElement = document.getElementById(contentId);
    } else if (content) {
      // Find the main content area or article element
      contentElement = document.querySelector('article') || document.querySelector('.blog-content') || document.querySelector('main');
    } else {
      contentElement = document.querySelector('article') || document.querySelector('.blog-content') || document.querySelector('main');
    }
    
    if (!contentElement) {
      setHeadings([]);
      headingsRef.current = [];
      return;
    }

    // Create a content signature to avoid reprocessing the same content
    const contentSignature = `${contentKey}-${headingLevelsKey}`;
    if (processedRef.current === contentSignature) {
      return; // Already processed this content
    }

    // Extract headings based on configured levels
    const headingSelector = headingLevels.map(level => `h${level}`).join(', ');
    const elements = Array.from(contentElement.querySelectorAll(headingSelector));
    
    // Track used IDs to ensure uniqueness
    const usedIds = new Set<string>();
    
    const headingsData = elements.map((element, index) => {
      // Make sure all headings have IDs for scrolling
      let id = element.id;
      if (!id) {
        id = element.textContent
          ?.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, '-') || `heading-${index}`;
      }
      
      // Ensure ID is unique by appending index if needed
      let uniqueId = id;
      let counter = 0;
      while (usedIds.has(uniqueId)) {
        counter++;
        uniqueId = `${id}-${counter}`;
      }
      usedIds.add(uniqueId);
      
      // Update element ID if it was changed (only if not already set)
      if (!element.id || element.id !== uniqueId) {
        element.id = uniqueId;
      }
      
      return {
        id: uniqueId,
        text: element.textContent || '',
        level: parseInt(element.tagName.substring(1)),
      };
    });
    
    // Only update if headings actually changed (compare by IDs and text)
    const currentIds = headingsRef.current.map(h => h.id).join('|');
    const newIds = headingsData.map(h => h.id).join('|');
    const currentTexts = headingsRef.current.map(h => h.text).join('|');
    const newTexts = headingsData.map(h => h.text).join('|');
    
    if (currentIds !== newIds || currentTexts !== newTexts) {
      headingsRef.current = headingsData;
      processedRef.current = contentSignature;
      setHeadings(headingsData);
    }
    
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
      ...observerOptions
    });
    
    observerRef.current = observer;
    elements.forEach(element => observer.observe(element));
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
    // Use stable keys instead of objects/arrays to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, headingLevelsKey, observerOptionsKey]);
  
  if (headings.length === 0) return null;
  
  const navClassName = sticky 
    ? `sticky top-8 ${className}` 
    : className;

  return (
    <nav className={`table-of-contents ${navClassName}`} aria-label="Table of Contents">
      <h3 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">Table of Contents</h3>
      <ul className="space-y-1">
        {headings.map((heading, index) => (
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
                {showNumbers && `${index + 1}. `}{heading.text}
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
