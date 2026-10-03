"""Firecrawl API client for scraping web content.

This module provides a wrapper around the Firecrawl API for scraping
clean markdown content from URLs discovered via search.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from shared.text_utils import normalize_text

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)


def scrape_urls(
    urls: List[str], 
    timeout: int = 30000,
    wait_for: int = 2000,
    include_tags: Optional[List[str]] = None,
    only_main_content: bool = False
) -> List[Dict[str, str]]:
    """Scrape content from URLs using Firecrawl.
    
    Uses the Firecrawl Python SDK to scrape markdown content from a list of URLs.
    Uses batch scrape for efficiency when multiple URLs are provided.
    
    Args:
        urls: List of URLs to scrape
        timeout: Maximum time to wait for scraping (milliseconds, default: 30000)
        wait_for: Time to wait for page load (milliseconds, default: 2000)
        include_tags: Optional list of CSS selectors to include (e.g., ["**.devsite-article-body"])
                     Use "**" prefix for glob-style matching
        only_main_content: Whether to extract only main content (default: False)
        
    Returns:
        List of dictionaries with keys: url, markdown
        Each dict contains the URL and its scraped markdown content.
        If scraping fails for a URL, markdown will be empty string.
    """
    if not urls:
        return []
    
    try:
        from firecrawl import Firecrawl
        
        api_key = os.environ.get("FIRECRAWL_API_KEY")
        if not api_key:
            logger.warning("FIRECRAWL_API_KEY not found in environment variables. Skipping Firecrawl scrape.")
            return [{"url": url, "markdown": ""} for url in urls]
        
        client = Firecrawl(api_key=api_key)
        
        # Build scrape kwargs - pass directly as keyword arguments (using snake_case)
        scrape_kwargs = {
            'formats': ['markdown'],
            'timeout': timeout,
            'wait_for': wait_for,
        }
        
        # Add tag filtering if specified (Python SDK uses snake_case)
        if include_tags:
            scrape_kwargs['include_tags'] = include_tags
            scrape_kwargs['only_main_content'] = only_main_content
        
        # Use batch scrape for multiple URLs (more efficient)
        if len(urls) > 1:
            try:
                # Use synchronous batch_scrape which handles polling automatically
                # batch_scrape takes urls, formats, poll_interval, and other options directly
                batch_result = client.batch_scrape(
                    urls=urls,
                    poll_interval=5,  # Poll every 5 seconds
                    **scrape_kwargs  # Pass formats, timeout, wait_for, includeTags, etc. as kwargs
                )
                
                # Extract results from batch response
                results = []
                if hasattr(batch_result, 'data') and batch_result.data:
                    for item in batch_result.data:
                        # Handle both object and dict responses
                        if hasattr(item, 'markdown'):
                            # Object response
                            url = item.metadata.sourceURL if hasattr(item, 'metadata') and hasattr(item.metadata, 'sourceURL') else ""
                            markdown = normalize_text(item.markdown) if item.markdown else ""
                        elif isinstance(item, dict):
                            # Dict response
                            url = item.get('url', '') or (item.get('metadata', {}).get('sourceURL', '') if isinstance(item.get('metadata'), dict) else '')
                            markdown = normalize_text(item.get('markdown', '')) if item.get('markdown') else ""
                        else:
                            url = ""
                            markdown = ""
                        
                        results.append({
                            "url": url,
                            "markdown": markdown or ""
                        })
                
                logger.debug(f"Firecrawl batch scrape completed for {len(results)} URLs")
                return results
                
            except Exception as e:
                logger.warning(f"Firecrawl batch scrape failed: {e}. Falling back to individual scrapes.")
                # Fall through to individual scraping
        
        # Fallback: scrape URLs individually
        results = []
        for url in urls:
            try:
                # Pass options directly as keyword arguments
                scrape_result = client.scrape(url, **scrape_kwargs)
                
                raw_markdown = scrape_result.markdown if hasattr(scrape_result, 'markdown') else ""
                markdown = normalize_text(raw_markdown) if raw_markdown else ""
                results.append({
                    "url": url,
                    "markdown": markdown
                })
                logger.debug(f"Scraped content from {url} ({len(markdown)} chars)")
                
            except Exception as e:
                logger.warning(f"Failed to scrape {url}: {e}")
                results.append({
                    "url": url,
                    "markdown": ""
                })
        
        return results
        
    except ImportError:
        logger.warning("firecrawl-py package not installed. Install with: pip install firecrawl-py")
        return [{"url": url, "markdown": ""} for url in urls]
    except Exception as e:
        logger.warning(f"Firecrawl scrape failed: {e}. Continuing without content.")
        return [{"url": url, "markdown": ""} for url in urls]

