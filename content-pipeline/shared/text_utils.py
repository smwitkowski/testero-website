"""Text normalization utilities for cleaning and standardizing documentation content.

This module provides functions to normalize text content from various sources
(FireCrawl, EXA, etc.) by removing excessive whitespace, joining broken sentences,
and preserving markdown structure.
"""

import re
from typing import Optional


def normalize_text(text: str) -> str:
    """Clean and normalize documentation text by removing HTML artifacts, navigation elements,
    and fixing markdown formatting issues.
    
    This function:
    - Joins broken sentences that are split across multiple lines
    - Removes excessive whitespace and indentation
    - Preserves markdown structure (headers, lists, paragraphs)
    - Normalizes line breaks (max 2 consecutive newlines)
    
    Args:
        text: Raw text/markdown content from search/scrape results
        
    Returns:
        Cleaned and normalized text with proper formatting
    """
    if not text:
        return ""
    
    # Remove common HTML/navigation patterns
    # Remove skip links and navigation elements
    text = re.sub(r'\[Skip to main content\]\([^\)]+\)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Skip to main content', '', text, flags=re.IGNORECASE)
    
    # Fix broken markdown links - remove incomplete links like "[text](" without closing
    text = re.sub(r'\[([^\]]+)\]\([^\)]*$', r'\1', text, flags=re.MULTILINE)  # Incomplete links at end of line
    text = re.sub(r'\[([^\]]+)\]\([^\)]*\n', r'\1\n', text)  # Incomplete links followed by newline
    text = re.sub(r'\[([^\]]+)\]\([^\)]*\s', r'\1 ', text)  # Incomplete links followed by space
    
    # Remove image alt text patterns like [![...](...)]
    text = re.sub(r'!\[[^\]]*\]\([^\)]+\)', '', text)
    
    # Remove standalone image references
    text = re.sub(r'\[!\[[^\]]*\]\([^\)]+\)\]\([^\)]+\)', '', text)
    
    # Remove common navigation text patterns
    nav_patterns = [
        r'Console',
        r'Sign in',
        r'Start free',
        r'Home',
        r'Documentation',
        r'English|Deutsch|Español|Français|Italiano|Português|中文|日本語|한국어',
        r'Stay organized with collections',
        r'Save and categorize content',
        r'^URL:\s*https?://[^\s]+$',  # Remove "URL: https://..." lines
    ]
    for pattern in nav_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.MULTILINE)
    
    # Remove URLs that appear as text (but keep them in markdown links)
    # First, temporarily replace markdown links, then remove URLs, then restore links
    link_placeholders = {}
    link_counter = 0
    
    def replace_link(match):
        nonlocal link_counter
        placeholder = f"__LINK_PLACEHOLDER_{link_counter}__"
        link_placeholders[placeholder] = match.group(0)
        link_counter += 1
        return placeholder
    
    # Protect markdown links
    text = re.sub(r'\[([^\]]+)\]\(https?://[^\)]+\)', replace_link, text)
    
    # Now remove standalone URLs
    text = re.sub(r'https?://[^\s\)]+', '', text)
    
    # Restore markdown links
    for placeholder, link in link_placeholders.items():
        text = text.replace(placeholder, link)
    
    # Normalize whitespace - collapse multiple spaces
    text = re.sub(r'[ \t]+', ' ', text)
    
    # Split into lines for processing
    lines = text.split('\n')
    
    # First pass: strip leading/trailing whitespace from all lines
    lines = [line.strip() for line in lines]
    
    # Remove excessive blank lines - collapse multiple consecutive blank lines to single blank
    # This helps with joining broken sentences
    cleaned_pre_lines = []
    prev_was_blank = False
    for line in lines:
        if not line:
            if not prev_was_blank:
                cleaned_pre_lines.append('')
            prev_was_blank = True
        else:
            cleaned_pre_lines.append(line)
            prev_was_blank = False
    lines = cleaned_pre_lines
    
    # Second pass: join broken sentences and clean up lines
    cleaned_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Handle empty lines - check if they should be skipped (between sentence fragments)
        # or preserved (between paragraphs)
        if not line:
            # Look ahead to find next non-blank line
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            
            # Check if previous line should join with next line (skip blank if so)
            if cleaned_lines and cleaned_lines[-1] and j < len(lines):
                prev_line = cleaned_lines[-1]
                next_line = lines[j].strip()
                
                # Check if next line is structural
                next_is_header = next_line and re.match(r'^#+\s', next_line)
                next_is_list = next_line and (re.match(r'^[\s]*[-*+]\s', next_line) or re.match(r'^[\s]*\d+[.)]\s', next_line))
                next_is_code = next_line and next_line.startswith('```')
                
                # If previous line doesn't end with sentence punctuation and next starts lowercase,
                # and next is not structural, they should be joined - skip blank and join them
                if (not next_is_header and not next_is_list and not next_is_code and
                    prev_line[-1] not in '.!?:' and 
                    next_line and not next_line[0].isupper()):
                    # Join previous line with next line, skip blank
                    cleaned_lines[-1] = prev_line + ' ' + next_line
                    i = j + 1  # Skip blank and next line (already joined)
                    continue
            
            # If we get here, this blank line might be a paragraph break
            # Only preserve if previous line is a complete sentence
            if cleaned_lines and cleaned_lines[-1] and cleaned_lines[-1][-1] in '.!?:':
                # Check if next line is also complete or is a header
                if j < len(lines):
                    next_line = lines[j].strip()
                    next_is_complete = next_line and next_line[-1] in '.!?:'
                    next_is_header = next_line and re.match(r'^#+\s', next_line)
                    if next_is_complete or next_is_header:
                        cleaned_lines.append('')
            i += 1
            continue
        
        # Skip very short lines that are mostly punctuation or navigation
        if len(line) < 3:
            i += 1
            continue
            
        # Skip lines that are mostly punctuation
        if re.match(r'^[^\w\s]*$', line):
            i += 1
            continue
        
        # Skip lines that look like navigation breadcrumbs or metadata
        if re.match(r'^(URL:|Content:|Title:|\d+\.\s*Tutorials?\s+overview)', line, re.IGNORECASE):
            i += 1
            continue
        
        # Check if this is a markdown structural element (header, list item, code block)
        is_header = re.match(r'^#+\s', line)
        is_list_item = re.match(r'^[\s]*[-*+]\s', line) or re.match(r'^[\s]*\d+[.)]\s', line)
        is_code_block = line.startswith('```') or (line.startswith('    ') and len(line) > 4)
        
        # If it's a structural element, keep it as-is
        if is_header or is_list_item or is_code_block:
            cleaned_lines.append(line)
            i += 1
            continue
        
        # Check if this line should be joined with the next line(s)
        # Join if:
        # 1. Line doesn't end with sentence-ending punctuation (.!?:)
        # 2. Next line exists, is not empty, and is not a structural element
        # 3. Next line doesn't start with capital letter (indicating new sentence)
        # 4. Next line doesn't start with markdown structure
        
        should_join = False
        if i < len(lines) - 1:
            next_line = lines[i + 1].strip()
            
            if next_line:  # Next line is not empty
                # Check if next line is structural
                next_is_header = re.match(r'^#+\s', next_line)
                next_is_list = re.match(r'^[\s]*[-*+]\s', next_line) or re.match(r'^[\s]*\d+[.)]\s', next_line)
                next_is_code = next_line.startswith('```')
                
                if not (next_is_header or next_is_list or next_is_code):
                    # Check if current line should be joined
                    line_ends_sentence = line and line[-1] in '.!?:'
                    line_ends_comma_semicolon = line and line[-1] in ',;'
                    
                    # Join if:
                    # - Line doesn't end with sentence punctuation (clearly a continuation)
                    # - Line ends with comma/semicolon and next doesn't start with capital (continuation)
                    # - Line ends with a word (not punctuation) and next doesn't start with capital
                    if not line_ends_sentence:
                        # Check if next line starts with lowercase or is clearly a continuation
                        if next_line and not next_line[0].isupper():
                            should_join = True
                        elif line_ends_comma_semicolon:
                            # Comma/semicolon usually means continuation
                            should_join = True
        
        if should_join:
            # Join with next line(s) - keep joining until we hit a sentence boundary
            joined = line
            j = i + 1
            while j < len(lines):
                next_line = lines[j].strip()
                
                # Stop if empty line (paragraph break)
                if not next_line:
                    break
                
                # Stop if structural element
                if (re.match(r'^#+\s', next_line) or 
                    re.match(r'^[\s]*[-*+]\s', next_line) or 
                    re.match(r'^[\s]*\d+[.)]\s', next_line) or
                    next_line.startswith('```')):
                    break
                
                # Stop if next line starts a new sentence (capital letter after our joined text ends with punctuation)
                if joined and joined[-1] in '.!?:' and next_line and next_line[0].isupper():
                    break
                
                # Join this line
                joined = joined + ' ' + next_line
                j += 1
            
            cleaned_lines.append(joined)
            i = j  # Skip all joined lines
        else:
            # Keep line as-is
            cleaned_lines.append(line)
            i += 1
    
    text = '\n'.join(cleaned_lines)
    
    # Remove lines that are just numbers or very short fragments (but preserve after joining)
    final_lines = []
    for line in text.split('\n'):
        line_stripped = line.strip()
        # Keep lines with substantial content, markdown structure, or blank lines for paragraphs
        if not line_stripped:  # Blank line
            if final_lines and final_lines[-1]:  # Only add blank line if previous line wasn't blank
                final_lines.append('')
        elif len(line_stripped) > 15:  # Substantial content
            final_lines.append(line_stripped)
        elif re.match(r'^#+\s', line_stripped):  # Markdown header
            final_lines.append(line_stripped)
        elif re.match(r'^[\s]*[-*+]\s', line_stripped) or re.match(r'^[\s]*\d+[.)]\s', line_stripped):  # List item
            final_lines.append(line_stripped)
        elif line_stripped.startswith('```'):  # Code block marker
            final_lines.append(line_stripped)
        elif re.match(r'^\d+$', line_stripped):  # Skip lines that are just numbers
            continue
    
    text = '\n'.join(final_lines)
    
    # Normalize newlines - max 2 consecutive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    # Final pass: remove any remaining broken markdown patterns
    # Remove standalone opening brackets without closing
    text = re.sub(r'\[([^\]]*)$', r'\1', text, flags=re.MULTILINE)
    
    # Final normalization of whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    
    return text


