#!/usr/bin/env python3
"""Backfill embeddings for existing questions in the database.

This script generates and stores embeddings for questions that don't have them yet.
Useful after adding the stem_embedding column to populate it for existing questions.
"""

import sys
import logging
from pathlib import Path
from typing import Dict, Any, Optional

import click

# Add parent directory to path to import shared modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.supabase_client import SupabaseClient
from shared.embeddings import get_embedding

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@click.command()
@click.option(
    '--exam',
    default='GCP_PM_ML_ENG',
    help='Exam identifier (default: GCP_PM_ML_ENG)'
)
@click.option(
    '--domain-code',
    default=None,
    help='Domain code to backfill (default: all domains)'
)
@click.option(
    '--dry-run',
    is_flag=True,
    help='Show what would be updated without actually updating'
)
@click.option(
    '--limit',
    default=None,
    type=int,
    help='Maximum number of questions to process (default: all)'
)
def main(
    exam: str,
    domain_code: Optional[str],
    dry_run: bool,
    limit: Optional[int],
):
    """Backfill embeddings for existing questions that don't have them."""
    
    client = SupabaseClient()
    
    # Build query to find questions without embeddings
    query = (
        client.client.table('questions')
        .select('id, stem, domain_id, exam')
        .eq('exam', exam)
        .is_('stem_embedding', 'null')
    )
    
    if domain_code:
        # Get domain ID
        domain = client.get_domain_by_code(domain_code)
        if not domain:
            click.echo(f"Error: Domain '{domain_code}' not found", err=True)
            sys.exit(1)
        query = query.eq('domain_id', domain['id'])
    
    if limit:
        query = query.limit(limit)
    
    try:
        response = query.execute()
        questions = response.data if response.data else []
    except Exception as e:
        click.echo(f"Error fetching questions: {e}", err=True)
        sys.exit(1)
    
    if not questions:
        click.echo("No questions found without embeddings.")
        return
    
    click.echo(f"Found {len(questions)} questions without embeddings")
    if dry_run:
        click.echo("DRY RUN: Would generate embeddings for:")
        for q in questions[:10]:  # Show first 10
            click.echo(f"  - {q['id']}: {q['stem'][:80]}...")
        if len(questions) > 10:
            click.echo(f"  ... and {len(questions) - 10} more")
        return
    
    # Process questions
    success_count = 0
    failed_count = 0
    
    click.echo("")
    click.echo("Generating embeddings...")
    
    for i, question in enumerate(questions, 1):
        question_id = question['id']
        stem = question.get('stem', '')
        
        if not stem:
            click.echo(f"  [{i}/{len(questions)}] Skipping question {question_id} (no stem)")
            failed_count += 1
            continue
        
        try:
            # Generate embedding
            embedding = get_embedding(stem)
            
            # Update question
            if client.update_question_embedding(question_id, embedding):
                success_count += 1
                if (i % 10 == 0) or (i == len(questions)):
                    click.echo(f"  [{i}/{len(questions)}] Processed {success_count} successfully...")
            else:
                failed_count += 1
                click.echo(f"  [{i}/{len(questions)}] Failed to update question {question_id}", err=True)
                
        except Exception as e:
            failed_count += 1
            logger.error(f"Failed to process question {question_id}: {e}")
            click.echo(f"  [{i}/{len(questions)}] Error processing question {question_id}: {e}", err=True)
    
    # Summary
    click.echo("")
    click.echo("✅ Backfill complete!")
    click.echo(f"   Successfully processed: {success_count}")
    click.echo(f"   Failed: {failed_count}")
    click.echo(f"   Total: {len(questions)}")
    click.echo("")


if __name__ == "__main__":
    main()


