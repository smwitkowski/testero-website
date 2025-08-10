'use client';

import React, { useState } from 'react';
import { Share2, Twitter, Linkedin, Facebook, Link as LinkIcon, Check } from 'lucide-react';

interface SocialShareProps {
  title: string;
  url: string;
  description?: string;
  className?: string;
  variant?: 'compact' | 'detailed';
}

function SocialShare({ 
  title, 
  url, 
  description = '', 
  className = '',
  variant = 'compact'
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  
  // Ensure we're using the full URL and correct path format
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://testero.ai';
  
  // Handle different URL formats
  let formattedUrl = url;
  
  // Handle content hub/spoke URLs
  if (url.startsWith('/hub/')) {
    formattedUrl = `/content${url}`;
  } else if (url.startsWith('/spoke/')) {
    formattedUrl = `/content${url}`;
  } else if (!url.startsWith('/content/') && (url.includes('/hub/') || url.includes('/spoke/'))) {
    formattedUrl = `/content${url.substring(url.indexOf('/'))}`;
  }
  // Handle blog URLs - no need to add /content prefix for /blog/ paths
  
  const fullUrl = formattedUrl.startsWith('http') ? formattedUrl : `${baseUrl}${formattedUrl}`;
  
  // Prepare sharing URLs
  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`,
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(fullUrl)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(description)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
  };
  
  // Copy URL to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = fullUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = (platform: keyof typeof shareUrls) => {
    window.open(shareUrls[platform], '_blank', 'noopener,noreferrer,width=550,height=420');
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Share2 className="w-4 h-4 text-gray-500" />
        <button
          onClick={() => handleShare('twitter')}
          className="text-gray-600 hover:text-blue-500 transition-colors"
          aria-label="Share on Twitter"
        >
          <Twitter className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleShare('linkedin')}
          className="text-gray-600 hover:text-blue-700 transition-colors"
          aria-label="Share on LinkedIn"
        >
          <Linkedin className="w-4 h-4" />
        </button>
        <button
          onClick={copyToClipboard}
          className="text-gray-600 hover:text-green-600 transition-colors"
          aria-label="Copy link"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <LinkIcon className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      <button
        onClick={() => handleShare('twitter')}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        aria-label="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
        <span>Twitter</span>
      </button>
      <button
        onClick={() => handleShare('linkedin')}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="w-4 h-4" />
        <span>LinkedIn</span>
      </button>
      <button
        onClick={copyToClipboard}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
          copied 
            ? 'bg-green-600 text-white' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
        aria-label="Copy link"
      >
        {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
        <span>{copied ? 'Copied!' : 'Copy Link'}</span>
      </button>
    </div>
  );
}

// Export both default and named
export default SocialShare;
export { SocialShare };
