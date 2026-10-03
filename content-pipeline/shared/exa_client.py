"""Exa API client for searching technical facts.

This module provides a wrapper around the Exa API for searching
technical documentation and facts to ground question evaluation.
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


def search_technical_facts(
    query: str, 
    num_results: int = 3,
    include_domains: Optional[List[str]] = None,
    include_text: bool = True
) -> List[Dict[str, Any]]:
    """Search Exa for technical facts about a claim.
    
    Uses the Exa Python SDK to perform neural search with optional domain filtering.
    Can optionally skip content retrieval for faster, cheaper searches.
    
    Args:
        query: Search query string (natural language, no need for "site:" syntax)
        num_results: Number of results to return (default: 3)
        include_domains: Optional list of domains to include (e.g., ["docs.cloud.google.com"])
                        Use this instead of adding "site:" to the query string
        include_text: Whether to retrieve text content (default: True). 
                     Set to False for URL-only searches (faster, cheaper)
        
    Returns:
        List of dictionaries with keys: url, title, text (text will be empty if include_text=False)
    """
    try:
        from exa_py import Exa
        
        api_key = os.environ.get("EXA_API_KEY")
        if not api_key:
            logger.warning("EXA_API_KEY not found in environment variables. Skipping Exa search.")
            return []
        
        client = Exa(api_key=api_key)
        
        # Build search parameters
        search_params = {
            "query": query,
            "type": "neural",  # Use neural search for better semantic matching
            "num_results": num_results,
        }
        
        # Only include content extraction if requested (faster/cheaper when False)
        if include_text:
            search_params["contents"] = {
                "text": {
                    "max_characters": 50_000,  # Increased for better content coverage
                    "include_html_tags": False  # Exclude HTML tags for cleaner text
                }
            }
        
        # Add domain filtering if specified
        if include_domains:
            search_params["include_domains"] = include_domains
        
        # Perform search
        results = client.search(**search_params)
        
        # Extract results - Exa returns results in results.results
        search_results = [
            {
                "url": r.url,
                "title": r.title if hasattr(r, 'title') else "",
                "text": normalize_text(r.text) if (include_text and hasattr(r, 'text') and r.text) else ""
            }
            for r in results.results
        ]
        
        logger.debug(f"Exa search returned {len(search_results)} results for query: {query[:50]}...")
        return search_results
        
    except ImportError:
        logger.warning("exa-py package not installed. Install with: pip install exa-py")
        return []
    except Exception as e:
        logger.warning(f"Exa search failed: {e}. Continuing without research context.")
        return []


