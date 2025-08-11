'use client';

import React, { useState } from 'react';
import { Share2, Twitter, Linkedin, Facebook, Link as LinkIcon, Check } from 'lucide-react';
import { SocialShareProps } from './types';

function SocialShare({ 
  title, 
  url, 
  description = '', 
  className = '',
  variant = 'compact',
  platforms = ['twitter', 'linkedin', 'copy']
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

  const renderPlatformButton = (platform: string, compactMode: boolean = false) => {
    const platformConfig = {
      twitter: { 
        icon: Twitter, 
        label: 'Share on Twitter', 
        action: () => handleShare('twitter'),
        color: compactMode ? 'hover:text-blue-500' : 'bg-blue-500 hover:bg-blue-600'
      },
      linkedin: { 
        icon: Linkedin, 
        label: 'Share on LinkedIn', 
        action: () => handleShare('linkedin'),
        color: compactMode ? 'hover:text-blue-700' : 'bg-blue-700 hover:bg-blue-800'
      },
      facebook: { 
        icon: Facebook, 
        label: 'Share on Facebook', 
        action: () => handleShare('facebook'),
        color: compactMode ? 'hover:text-blue-600' : 'bg-blue-600 hover:bg-blue-700'
      },
      copy: { 
        icon: copied ? Check : LinkIcon, 
        label: 'Copy link', 
        action: copyToClipboard,
        color: compactMode 
          ? (copied ? 'text-green-600' : 'hover:text-green-600')
          : (copied ? 'bg-green-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
      }
    };

    if (!platformConfig[platform as keyof typeof platformConfig]) return null;
    
    const config = platformConfig[platform as keyof typeof platformConfig];
    const IconComponent = config.icon;

    if (compactMode) {
      return (
        <button
          key={platform}
          onClick={config.action}
          className={`text-gray-600 transition-colors ${config.color}`}
          aria-label={config.label}
        >
          <IconComponent className="w-4 h-4" />
        </button>
      );
    }

    return (
      <button
        key={platform}
        onClick={config.action}
        className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${config.color}`}
        aria-label={config.label}
      >
        <IconComponent className="w-4 h-4" />
        <span>{platform === 'copy' ? (copied ? 'Copied!' : 'Copy Link') : platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
      </button>
    );
  };

  if (variant === 'compact' || variant === 'minimal') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {variant === 'compact' && <Share2 className="w-4 h-4 text-gray-500" />}
        {platforms.map(platform => renderPlatformButton(platform, true))}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {platforms.map(platform => renderPlatformButton(platform, false))}
    </div>
  );
}

// Export both default and named
export default SocialShare;
export { SocialShare };
