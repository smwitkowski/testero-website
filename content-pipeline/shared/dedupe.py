"""Question deduplication utilities.

This module provides both lexical (Jaccard) and semantic (embedding-based)
similarity checks to detect duplicate or near-duplicate question stems.
"""

import re
import math
from typing import List


def strip_markdown(text: str) -> str:
    """Strip markdown formatting from text, keeping only the plain text content.
    
    This is a shared utility extracted from the generation script to ensure
    consistent normalization across the pipeline.
    
    Args:
        text: Text that may contain markdown formatting
        
    Returns:
        Plain text with markdown removed
    """
    if not text:
        return text
    
    # Remove markdown code blocks (```code``` or `code`)
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    
    # Remove markdown links but keep the link text: [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    
    # Remove markdown images: ![alt](url) -> alt
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', r'\1', text)
    
    # Remove markdown headers (# Header -> Header)
    text = re.sub(r'^#{1,6}\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    
    # Remove markdown bold (**text** or __text__ -> text)
    text = re.sub(r'\*\*([^\*]+)\*\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    
    # Remove markdown italic (*text* or _text_ -> text, but be careful not to remove underscores in words)
    text = re.sub(r'(?<!\w)\*([^\*]+)\*(?!\w)', r'\1', text)
    text = re.sub(r'(?<!\w)_([^_]+)_(?!\w)', r'\1', text)
    
    # Remove markdown strikethrough (~~text~~ -> text)
    text = re.sub(r'~~([^~]+)~~', r'\1', text)
    
    # Remove markdown blockquotes (> text -> text)
    text = re.sub(r'^>\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    
    # Remove markdown horizontal rules
    text = re.sub(r'^[-*]{3,}$', '', text, flags=re.MULTILINE)
    
    # Remove markdown list markers (- item, * item, 1. item -> item)
    text = re.sub(r'^[\s]*[-*+]\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    text = re.sub(r'^[\s]*\d+\.\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    
    # Clean up extra whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)  # Max 2 consecutive newlines
    text = text.strip()
    
    return text


def normalize_stem(text: str) -> str:
    """Normalize a question stem for duplicate detection.
    
    Applies markdown stripping, lowercasing, and whitespace normalization
    to create a canonical form for comparison.
    
    Args:
        text: Raw question stem text
        
    Returns:
        Normalized stem string
    """
    if not text:
        return ""
    
    # Strip markdown first
    text = strip_markdown(text)
    
    # Lowercase and normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip().lower()
    
    return text


def jaccard_similarity(a: str, b: str) -> float:
    """Compute Jaccard similarity between two strings based on token sets.
    
    Jaccard similarity = |A ∩ B| / |A ∪ B|
    Returns a value between 0.0 (no overlap) and 1.0 (identical token sets).
    
    Args:
        a: First string
        b: Second string
        
    Returns:
        Jaccard similarity score between 0.0 and 1.0
    """
    if not a or not b:
        return 0.0
    
    # Tokenize by splitting on whitespace
    tokens_a = set(a.split())
    tokens_b = set(b.split())
    
    if not tokens_a or not tokens_b:
        return 0.0
    
    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    
    if union == 0:
        return 0.0
    
    return intersection / union


def is_duplicate_stem(stem: str, existing_norm_stems: List[str], threshold: float = 0.9) -> bool:
    """Check if a stem is a duplicate of any existing normalized stems.
    
    Normalizes the input stem and compares it against a list of pre-normalized
    stems using Jaccard similarity. Returns True if any similarity score
    meets or exceeds the threshold.
    
    Args:
        stem: Raw question stem to check
        existing_norm_stems: List of already-normalized stems to compare against
        threshold: Similarity threshold (0.0-1.0). Default 0.9 means 90% token overlap.
        
    Returns:
        True if stem is a duplicate (similarity >= threshold), False otherwise
    """
    if not stem or not existing_norm_stems:
        return False
    
    norm_stem = normalize_stem(stem)
    
    for existing_norm in existing_norm_stems:
        similarity = jaccard_similarity(norm_stem, existing_norm)
        if similarity >= threshold:
            return True
    
    return False


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two embedding vectors.
    
    Cosine similarity = (A · B) / (||A|| * ||B||)
    Returns a value between -1.0 (opposite) and 1.0 (identical).
    For normalized embeddings, this typically ranges from 0.0 to 1.0.
    
    Args:
        a: First embedding vector (list of floats)
        b: Second embedding vector (list of floats, same length as a)
        
    Returns:
        Cosine similarity score between -1.0 and 1.0
        
    Raises:
        ValueError: If vectors have different lengths or are empty
    """
    if not a or not b:
        return 0.0
    
    if len(a) != len(b):
        raise ValueError(f"Vectors must have same length: {len(a)} != {len(b)}")
    
    # Compute dot product
    dot_product = sum(x * y for x, y in zip(a, b))
    
    # Compute magnitudes
    magnitude_a = math.sqrt(sum(x * x for x in a))
    magnitude_b = math.sqrt(sum(x * x for x in b))
    
    if magnitude_a == 0.0 or magnitude_b == 0.0:
        return 0.0
    
    # Cosine similarity
    similarity = dot_product / (magnitude_a * magnitude_b)
    
    return similarity


def is_semantic_duplicate(
    stem_embedding: List[float],
    existing_embeddings: List[List[float]],
    threshold: float = 0.85
) -> bool:
    """Check if a stem embedding is semantically similar to any existing embeddings.
    
    Compares the input embedding against a list of existing embeddings using
    cosine similarity. Returns True if any similarity score meets or exceeds
    the threshold.
    
    Args:
        stem_embedding: Embedding vector for the question stem to check
        existing_embeddings: List of existing embedding vectors to compare against
        threshold: Cosine similarity threshold (0.0-1.0). Default 0.85 catches paraphrases.
        
    Returns:
        True if stem is semantically similar (similarity >= threshold), False otherwise
    """
    if not stem_embedding or not existing_embeddings:
        return False
    
    for existing_embedding in existing_embeddings:
        try:
            similarity = cosine_similarity(stem_embedding, existing_embedding)
            if similarity >= threshold:
                return True
        except ValueError:
            # Skip embeddings with mismatched dimensions
            continue
    
    return False


