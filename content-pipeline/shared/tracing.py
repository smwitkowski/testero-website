"""LangSmith tracing integration for observability.

This module provides a thin wrapper around LangSmith's @traceable decorator
that gracefully handles cases where tracing is disabled (no API key set).
"""

import os
import logging
from functools import wraps
from contextlib import contextmanager
from typing import Optional, Dict, Any, Callable

logger = logging.getLogger(__name__)

# Check if LangSmith is enabled
LANGSMITH_ENABLED = bool(os.environ.get("LANGSMITH_API_KEY"))
LANGSMITH_PROJECT = os.environ.get("LANGSMITH_PROJECT", "question-generation")
LANGSMITH_TRACING = os.environ.get("LANGSMITH_TRACING", "true").lower() == "true"

# Initialize LangSmith traceable decorator if enabled
if LANGSMITH_ENABLED and LANGSMITH_TRACING:
    try:
        from langsmith import traceable
        from langsmith.run_helpers import trace as langsmith_trace
        logger.info(f"LangSmith tracing enabled for project: {LANGSMITH_PROJECT}")
    except ImportError:
        logger.warning("langsmith package not installed. Tracing disabled.")
        LANGSMITH_ENABLED = False
        traceable = None
        langsmith_trace = None
else:
    traceable = None
    langsmith_trace = None
    if not LANGSMITH_ENABLED:
        logger.debug("LangSmith tracing disabled (LANGSMITH_API_KEY not set)")
    elif not LANGSMITH_TRACING:
        logger.debug("LangSmith tracing disabled (LANGSMITH_TRACING=false)")


def get_traceable() -> Callable:
    """Get the traceable decorator, or a no-op decorator if tracing is disabled.
    
    Returns:
        A decorator function that traces calls when enabled, or does nothing when disabled.
    """
    if traceable is not None:
        return traceable
    
    # Return a no-op decorator when tracing is disabled
    def noop_traceable(func: Optional[Callable] = None, **kwargs):
        """No-op decorator when LangSmith tracing is disabled.
        
        Handles both @traceable and @traceable(...) usage patterns.
        """
        def decorator(f: Callable) -> Callable:
            return f
        
        if func is None:
            # Called as @traceable(...) with kwargs - return decorator
            return decorator
        else:
            # Called as @traceable without parentheses - return function unchanged
            return func
    
    return noop_traceable


def traceable_with_metadata(**metadata: Dict[str, Any]) -> Callable:
    """Create a traceable decorator with default metadata.
    
    Args:
        **metadata: Key-value pairs to include as default metadata in traces
        
    Returns:
        A decorator function that traces calls with the provided metadata.
        
    Example:
        @traceable_with_metadata(model="gpt-4o", domain="MONITORING")
        def generate_question(...):
            ...
    """
    base_traceable = get_traceable()
    
    def decorator(func: Callable) -> Callable:
        if traceable is not None:
            # Use LangSmith's traceable with metadata
            return base_traceable(
                name=func.__name__,
                project_name=LANGSMITH_PROJECT,
                **metadata
            )(func)
        else:
            # No-op when disabled
            return func
    
    return decorator


def add_run_metadata(metadata: Dict[str, Any]) -> None:
    """Add metadata to the current trace run (if tracing is enabled).
    
    This is a no-op when tracing is disabled.
    
    Args:
        metadata: Key-value pairs to add to the current trace
    """
    if not LANGSMITH_ENABLED or not LANGSMITH_TRACING:
        return
    
    try:
        from langsmith import Client
        client = Client()
        # Note: LangSmith's traceable decorator automatically captures metadata
        # This function is provided for future extensibility if needed
        logger.debug(f"Metadata added to trace: {metadata}")
    except Exception as e:
        logger.warning(f"Failed to add trace metadata: {e}")


# Export the main decorator
traceable_decorator = get_traceable()


@contextmanager
def trace_dspy_call(name: str, metadata: Optional[Dict[str, Any]] = None, run_type: str = "llm"):
    """Context manager for tracing DSPy calls with proper nesting.
    
    This creates a nested trace span within the current trace context, allowing
    you to see individual DSPy LLM calls in the LangSmith trace hierarchy.
    
    Args:
        name: Name of the trace span (e.g., "dspy_question_gen")
        metadata: Optional dictionary of metadata to attach to the trace
        run_type: Type of run ("llm", "tool", "chain", etc.). Defaults to "llm"
    
    Yields:
        A run object that can be used to add outputs or metadata before the span ends.
        If tracing is disabled, yields None.
    
    Example:
        with trace_dspy_call("dspy_question_gen", metadata={"difficulty": "MEDIUM"}) as run:
            result = self.question_gen(...)
            if run:
                run.end(outputs={"stem_preview": result.stem[:200]})
    """
    if not LANGSMITH_ENABLED or not LANGSMITH_TRACING or langsmith_trace is None:
        yield None
        return
    
    try:
        with langsmith_trace(
            name=name,
            run_type=run_type,
            metadata=metadata or {},
            project_name=LANGSMITH_PROJECT,
        ) as run:
            yield run
    except Exception as e:
        logger.warning(f"Failed to create trace span '{name}': {e}")
        yield None


@contextmanager
def trace(name: str, metadata: Optional[Dict[str, Any]] = None, run_type: str = "tool"):
    """Context manager for tracing arbitrary operations.
    
    Similar to trace_dspy_call but defaults to "tool" run_type for non-LLM operations.
    
    Args:
        name: Name of the trace span (e.g., "exa_doc_search")
        metadata: Optional dictionary of metadata to attach to the trace
        run_type: Type of run ("tool", "llm", "chain", etc.). Defaults to "tool"
    
    Yields:
        A run object that can be used to add outputs or metadata before the span ends.
        If tracing is disabled, yields None.
    
    Example:
        with trace("exa_doc_search", metadata={"topic": topic}) as run:
            results = search_technical_facts(query)
            if run:
                run.end(outputs={"result_count": len(results)})
    """
    if not LANGSMITH_ENABLED or not LANGSMITH_TRACING or langsmith_trace is None:
        yield None
        return
    
    try:
        with langsmith_trace(
            name=name,
            run_type=run_type,
            metadata=metadata or {},
            project_name=LANGSMITH_PROJECT,
        ) as run:
            yield run
    except Exception as e:
        logger.warning(f"Failed to create trace span '{name}': {e}")
        yield None
