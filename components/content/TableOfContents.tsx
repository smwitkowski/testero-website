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
      <ul className="text-base">
        {headings.map((heading, index) => {
          const isH2 = heading.level === 2;
          const isH3 = heading.level === 3;
          
          return (
            <li key={heading.id} className="py-1">
              <Link
                href={`#${heading.id}`}
                data-level={isH2 ? 'two' : 'three'}
                className={`
                  flex items-center justify-start
                  ${isH2 ? 'pl-0 pt-2 border-t border-solid border-gray-900/40 dark:border-gray-100/40' : ''}
                  ${isH3 ? 'pl-4 sm:pl-6' : ''}
                  ${activeId === heading.id 
                    ? 'text-blue-600 dark:text-blue-400 font-medium' 
                    : 'text-gray-900 dark:text-white hover:underline'
                  }
                  transition-colors duration-200
                `}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(heading.id)?.scrollIntoView({
                    behavior: 'smooth',
                  });
                  setActiveId(heading.id);
                }}
              >
                {isH3 && (
                  <span className="flex w-1 h-1 rounded-full bg-gray-900 dark:bg-gray-100 mr-2 flex-shrink-0">&nbsp;</span>
                )}
                <span className="hover:underline">
                  {showNumbers && `${index + 1}. `}{heading.text}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Export both default and named
export default TableOfContents;
export { TableOfContents };
