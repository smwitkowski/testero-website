"""OpenAI embeddings for semantic duplicate detection.

This module provides a wrapper around OpenAI's text-embedding-3-small model
for generating embeddings of question stems to enable semantic similarity detection.
"""

import os
import logging
from typing import List
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)


def get_embedding(text: str) -> List[float]:
    """Generate an embedding vector for the given text using OpenAI.
    
    Uses text-embedding-3-small model which produces 1536-dimensional vectors.
    Cost: ~$0.02 per 1M tokens (very cheap).
    
    Args:
        text: Text to embed (e.g., question stem)
        
    Returns:
        List of 1536 float values representing the embedding vector
        
    Raises:
        ValueError: If OPENAI_API_KEY is not set
        Exception: If embedding generation fails
    """
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError(
            "openai package not installed. Install with: pip install openai"
        )
    
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY not found in environment variables. "
            "Please set it in your .env file."
        )
    
    client = OpenAI(api_key=api_key)
    
    try:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        
        # Extract embedding vector from response
        embedding = response.data[0].embedding
        
        logger.debug(f"Generated embedding for text: {text[:50]}...")
        return embedding
        
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        raise


