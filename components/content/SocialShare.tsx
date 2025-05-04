'use client';

import React, { useState } from 'react';

interface SocialShareProps {
  title: string;
  url: string;
  description?: string;
  className?: string;
}

export default function SocialShare({ 
  title, 
  url, 
  description = '', 
  className = '' 
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  
  // Ensure we're using the full URL
  const fullUrl = url.startsWith('http') ? url : `https://testero.io${url}`;
  
  // Prepare sharing URLs
  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`,
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(fullUrl)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(description)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
  };
  
  // Copy URL to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      <span className="text-gray-500 text-sm">Share:</span>
      
      {/* Twitter/X */}
      <a 
        href={shareUrls.twitter} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-gray-600 hover:text-blue-400 transition-colors"
        aria-label="Share on Twitter"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
        </svg>
      </a>
      
      {/* LinkedIn */}
      <a 
        href={shareUrls.linkedin} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-gray-600 hover:text-blue-600 transition-colors"
        aria-label="Share on LinkedIn"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      </a>
      
      {/* Facebook */}
      <a 
        href={shareUrls.facebook} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-gray-600 hover:text-blue-800 transition-colors"
        aria-label="Share on Facebook"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.032 23L9 13H5V9h4V6.5C9 2.789 11.298 1 14.61 1c1.585 0 2.948.118 3.345.17v3.88H15.66c-1.315 0-1.57.623-1.57 1.536V9h4.34l-1 4h-3.34v10H9.032z"/>
        </svg>
      </a>
      
      {/* Copy Link Button */}
      <button 
        onClick={copyToClipboard}
        className="text-gray-600 hover:text-blue-600 transition-colors focus:outline-none"
        aria-label="Copy link"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        {copied && (
          <span className="absolute -mt-8 ml-2 bg-gray-800 text-white text-xs px-2 py-1 rounded">
            Copied!
          </span>
        )}
      </button>
    </div>
  );
}
