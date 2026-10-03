"""Web search module for Google Cloud documentation.

This module searches for relevant Google Cloud documentation to ground
question generation in real, up-to-date documentation.
"""

import os
import re
import logging
from typing import List, Optional, Tuple
from dotenv import load_dotenv
from shared.text_utils import normalize_text
from shared.tracing import trace

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)


def search_google_docs(
    topic: str, 
    services: List[str], 
    num_results: int = 5,
    subsection_considerations: Optional[List[str]] = None
) -> Tuple[str, List[str]]:
    """Search for Google Cloud documentation relevant to the topic.
    
    Uses Exa AI web search to find relevant Google Cloud documentation pages,
    then uses Firecrawl to scrape clean markdown content from those pages.
    Filters for cloud.google.com domains.
    
    Args:
        topic: The topic or domain name (e.g., "Architecting Low-Code ML Solutions")
        services: List of relevant Google Cloud services (e.g., ["Vertex AI", "BigQuery ML"])
        num_results: Number of search results to return (default: 5)
        subsection_considerations: Optional list of subsection-specific considerations to include in search
        
    Returns:
        Tuple of (formatted_context_string, doc_links_list)
        - formatted_context_string: Formatted documentation context for LLM prompts
        - doc_links_list: List of documentation URLs found
    """
    try:
        from shared.exa_client import search_technical_facts
        from shared.firecrawl_client import scrape_urls
        
        # Build search query - no need for "site:" syntax, we'll use include_domains parameter
        services_str = ", ".join(services[:5])  # Use top 5 services for better coverage
        
        # Build query without domain restriction (Exa will filter via include_domains)
        query_parts = [f"Google Cloud {services_str}", topic]
        if subsection_considerations:
            # Add key terms from considerations to improve search relevance
            key_terms = " ".join([c.split("(")[0].strip() for c in subsection_considerations[:3]])
            query_parts.append(key_terms)
        
        query = " ".join(query_parts)
        
        logger.info(f"Searching for documentation: {query[:100]}...")
        
        # Step 1: Use Exa to find URLs (no content extraction for speed/cost)
        with trace("exa_doc_search", metadata={
            "topic": topic,
            "num_results": num_results,
            "services": services[:3],  # Limit to first 3 services
        }) as exa_run:
            # Capture inputs for debugging
            if exa_run:
                exa_run.inputs = {
                    "topic": topic,
                    "services": services[:5],
                    "query": query[:300],
                    "num_results": num_results,
                    "include_domains": ["docs.cloud.google.com"],
                }
            
            search_results = search_technical_facts(
                query, 
                num_results=num_results,
                include_domains=["docs.cloud.google.com"],
                include_text=False  # Skip content extraction, we'll use Firecrawl
            )
            
            # Results are already filtered by Exa via include_domains, so use them directly
            filtered_results = search_results
            doc_links = [result.get("url", "") for result in filtered_results if result.get("url")]
            
            # If we didn't get enough results, try a more general search without domain restriction
            if len(filtered_results) < num_results and len(services) > 0:
                logger.debug(f"Only found {len(filtered_results)} results, trying broader search")
                # Try searching for each service individually, still with domain filter
                for service in services[:3]:
                    if len(filtered_results) >= num_results:
                        break
                    service_query = f"Google Cloud {service} {topic}"
                    service_results = search_technical_facts(
                        service_query, 
                        num_results=2,
                        include_domains=["docs.cloud.google.com"],
                        include_text=False  # Skip content extraction
                    )
                    existing_urls = {r.get("url") for r in filtered_results if r.get("url")}
                    for result in service_results:
                        url = result.get("url", "")
                        if url and url not in existing_urls:
                            filtered_results.append(result)
                            doc_links.append(url)
            
            if exa_run:
                exa_run.end(outputs={
                    "url_count": len(doc_links),
                    "urls": doc_links[:5],  # Limit to first 5 URLs
                })
        
        # Step 2: Scrape content from URLs using Firecrawl
        # Use tag filtering for Google Cloud documentation to get only article body
        if doc_links:
            logger.info(f"Scraping content from {len(doc_links)} URLs with Firecrawl...")
            with trace("firecrawl_scrape", metadata={
                "url_count": len(doc_links),
            }) as firecrawl_run:
                # Capture inputs for debugging
                if firecrawl_run:
                    firecrawl_run.inputs = {
                        "urls": doc_links[:10],  # Limit to first 10 URLs for readability
                        "url_count": len(doc_links),
                        "include_tags": ["**.devsite-article-body"],
                        "only_main_content": False,
                    }
                
                scraped_content = scrape_urls(
                    doc_links,
                    include_tags=["**.devsite-article-body"],  # Google Cloud docs article body selector
                    only_main_content=False
                )
                if firecrawl_run:
                    firecrawl_run.end(outputs={
                        "scraped_count": len(scraped_content),
                        "has_content": any(item.get("markdown") for item in scraped_content),
                    })
            
            # Step 3: Merge Firecrawl content with Exa search results
            # Create a mapping of URL to markdown content
            # Normalize URLs for matching (remove trailing slashes, lowercase)
            def normalize_url(url: str) -> str:
                """Normalize URL for matching."""
                if not url:
                    return ""
                url = url.rstrip('/').lower()
                # Remove common query parameters that don't affect content
                if '?' in url:
                    url = url.split('?')[0]
                return url
            
            url_to_content = {}
            for item in scraped_content:
                scraped_url = normalize_url(item.get("url", ""))
                if scraped_url:
                    url_to_content[scraped_url] = item.get("markdown", "")
            
            # Also create a mapping from original URLs (in case Firecrawl returns different format)
            for i, original_url in enumerate(doc_links):
                normalized = normalize_url(original_url)
                if normalized and normalized not in url_to_content and i < len(scraped_content):
                    # Use index-based matching as fallback
                    url_to_content[normalized] = scraped_content[i].get("markdown", "")
            
            # Update search results with Firecrawl content
            for result in filtered_results:
                url = result.get("url", "")
                normalized_url = normalize_url(url)
                if normalized_url in url_to_content:
                    result["text"] = url_to_content[normalized_url]
                else:
                    result["text"] = ""
        
        # Format context string with documentation snippets
        if filtered_results:
            formatted_context = "Relevant Google Cloud Documentation:\n\n"
            
            # Add service list
            formatted_context += f"Services: {services_str}\n\n"
            
            # Add documentation snippets
            formatted_context += "Documentation References:\n"
            for i, result in enumerate(filtered_results[:num_results], 1):
                title = result.get("title", "Untitled")
                url = result.get("url", "")
                raw_markdown = result.get("text", "")  # This is now Firecrawl markdown (already normalized)
                
                # Content is already normalized by Firecrawl/EXA clients, but normalize again for defensive programming
                cleaned_text = normalize_text(raw_markdown) if raw_markdown else ""
                
                # Use full cleaned text without character limits
                # Firecrawl markdown is cleaner than Exa text, so less cleaning needed
                if cleaned_text:
                    # Use the full cleaned text - no truncation
                    text_preview = cleaned_text
                else:
                    # If cleaned text is empty, try normalizing raw markdown again
                    if raw_markdown:
                        text_preview = normalize_text(raw_markdown)
                    else:
                        text_preview = ""
                
                formatted_context += f"\n{i}. {title}\n"
                formatted_context += f"   URL: {url}\n"
                if text_preview and len(text_preview.strip()) > 50:  # Only include if meaningful content
                    formatted_context += f"   Content: {text_preview}\n"
            
            formatted_context += "\nWhen generating the question, reference these official Google Cloud services and "
            formatted_context += "their documented capabilities. Ensure the question scenarios align with real "
            formatted_context += "Google Cloud documentation and best practices. Use specific service names and "
            formatted_context += "features mentioned in the documentation above."
            
            logger.debug(f"Found {len(doc_links)} documentation links")
            return formatted_context, doc_links
        else:
            # Fallback: return basic context without documentation snippets
            logger.warning(f"No docs.cloud.google.com documentation found for query: {query[:100]}")
            doc_links = [
                f"https://docs.cloud.google.com/{service.lower().replace(' ', '-')}"
                for service in services[:3]
            ]
            
            formatted_context = f"""Relevant Google Cloud Documentation:

Services: {services_str}

Documentation Links:
{chr(10).join(f'- {link}' for link in doc_links)}

When generating the question, reference these official Google Cloud services and 
their documented capabilities. Ensure the question scenarios align with real 
Google Cloud documentation and best practices."""
            
            return formatted_context, doc_links
        
    except ImportError:
        logger.warning("Exa client not available. Using fallback documentation links.")
        # Fallback to placeholder implementation
        services_str = ", ".join(services[:3])
        doc_links = [
            f"https://docs.cloud.google.com/{service.lower().replace(' ', '-')}"
            for service in services[:3]
        ]
        
        formatted_context = f"""Relevant Google Cloud Documentation:

Services: {services_str}

Documentation Links:
{chr(10).join(f'- {link}' for link in doc_links)}

When generating the question, reference these official Google Cloud services and 
their documented capabilities. Ensure the question scenarios align with real 
Google Cloud documentation and best practices."""
        
        return formatted_context, doc_links
        
    except Exception as e:
        logger.warning(f"Documentation search failed: {e}. Continuing without doc context.")
        # Return empty context if search fails
        return "", []


def search_google_docs_with_exa(
    topic: str, 
    services: List[str], 
    num_results: int = 5,
    subsection_considerations: Optional[List[str]] = None
) -> Tuple[str, List[str]]:
    """Search for Google Cloud documentation using Exa AI.
    
    This is an alias for search_google_docs that uses the Exa client.
    Maintained for backward compatibility.
    
    Args:
        topic: The topic or domain name
        services: List of relevant Google Cloud services
        num_results: Number of search results to return
        subsection_considerations: Optional list of subsection-specific considerations
        
    Returns:
        Tuple of (formatted_context_string, doc_links_list)
    """
    return search_google_docs(topic, services, num_results, subsection_considerations)
