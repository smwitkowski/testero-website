#!/usr/bin/env python3
"""Generate stub questions to test content pipeline.

This script creates a generation run and inserts stub canonical questions
(no LLM yet) to prove out the content pipeline end-to-end.
"""

import sys
from pathlib import Path
from datetime import datetime

import click

# Add parent directory to path to import shared modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.supabase_client import SupabaseClient


@click.command()
@click.option(
    '--exam',
    default='GCP_PM_ML_ENG',
    help='Exam identifier (default: GCP_PM_ML_ENG)'
)
@click.option(
    '--domain-code',
    required=True,
    help='Domain code (e.g., DATA_PIPELINES, MONITORING_ML_SOLUTIONS)'
)
@click.option(
    '--n-questions',
    default=10,
    type=int,
    help='Number of stub questions to generate (default: 10)'
)
@click.option(
    '--prompt-version',
    default=None,
    help='Optional prompt version identifier'
)
@click.option(
    '--notes',
    default=None,
    help='Optional notes about this generation run'
)
def main(exam: str, domain_code: str, n_questions: int, prompt_version: str | None, notes: str | None):
    """Generate stub questions for testing the content pipeline."""
    
    click.echo(f"🚀 Starting stub question generation...")
    click.echo(f"   Exam: {exam}")
    click.echo(f"   Domain: {domain_code}")
    click.echo(f"   Target count: {n_questions}")
    
    try:
        # 1. Connect to Supabase
        client = SupabaseClient()
        click.echo("✓ Connected to Supabase")
        
        # 2. Look up exam_domains row by domain_code, fail fast if not found
        domain = client.get_domain_by_code(domain_code)
        if not domain:
            click.echo(f"❌ Error: Domain '{domain_code}' not found in exam_domains table", err=True)
            click.echo("   Valid domain codes include:", err=True)
            click.echo("   - ARCHITECTING_LOW_CODE_ML_SOLUTIONS", err=True)
            click.echo("   - COLLABORATING_TO_MANAGE_DATA_AND_MODELS", err=True)
            click.echo("   - SCALING_PROTOTYPES_INTO_ML_MODELS", err=True)
            click.echo("   - SERVING_AND_SCALING_MODELS", err=True)
            click.echo("   - AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES", err=True)
            click.echo("   - MONITORING_ML_SOLUTIONS", err=True)
            sys.exit(1)
        
        click.echo(f"✓ Found domain: {domain['name']} (ID: {domain['id']})")
        
        # 3. Insert a new row into question_generation_runs
        run_data = {
            "exam": exam,
            "domain_code": domain_code,
            "target_count": n_questions,
            "generated_count": 0,
            "model": "stub-generator",
            "prompt_version": prompt_version,
            "notes": notes
        }
        
        generation_run = client.create_generation_run(run_data)
        if not generation_run:
            click.echo("❌ Error: Failed to create generation run", err=True)
            sys.exit(1)
        
        run_id = generation_run['id']
        click.echo(f"✓ Created generation run: {run_id}")
        
        # 4. Loop from 1 to n_questions
        generated_count = 0
        for i in range(1, n_questions + 1):
            try:
                # Create canonical question row
                question_data = {
                    "exam": exam,
                    "domain_id": domain['id'],
                    "stem": f"Stub question {i} for {domain_code}",
                    "difficulty": "MEDIUM",
                    "status": "DRAFT",
                    "review_status": "UNREVIEWED",
                    "generation_run_id": run_id
                }
                
                question = client.insert_question(question_data)
                if not question:
                    click.echo(f"⚠️  Warning: Failed to insert question {i}", err=True)
                    continue
                
                question_id = question['id']
                
                # Insert corresponding answers rows (4 options: A-D, B is correct)
                answers_data = [
                    {
                        "question_id": question_id,
                        "choice_label": "A",
                        "choice_text": f"Option A for stub question {i}",
                        "is_correct": False
                    },
                    {
                        "question_id": question_id,
                        "choice_label": "B",
                        "choice_text": f"Option B for stub question {i}",
                        "is_correct": True
                    },
                    {
                        "question_id": question_id,
                        "choice_label": "C",
                        "choice_text": f"Option C for stub question {i}",
                        "is_correct": False
                    },
                    {
                        "question_id": question_id,
                        "choice_label": "D",
                        "choice_text": f"Option D for stub question {i}",
                        "is_correct": False
                    }
                ]
                
                answers = client.insert_answers_batch(answers_data)
                if not answers or len(answers) != 4:
                    click.echo(f"⚠️  Warning: Failed to insert all answers for question {i}", err=True)
                    continue
                
                # Insert explanations row
                explanation_data = {
                    "question_id": question_id,
                    "explanation_text": "Stub explanation for testing pipeline",
                    "doc_links": None
                }
                
                explanation = client.insert_explanation(explanation_data)
                if not explanation:
                    click.echo(f"⚠️  Warning: Failed to insert explanation for question {i}", err=True)
                    continue
                
                generated_count += 1
                if i % 5 == 0:
                    click.echo(f"   Progress: {i}/{n_questions} questions created...")
                
            except Exception as e:
                click.echo(f"⚠️  Error creating question {i}: {e}", err=True)
                continue
        
        # 5. Update question_generation_runs: set generated_count and completed_at
        update_data = {
            "generated_count": generated_count,
            "completed_at": datetime.utcnow().isoformat()
        }
        
        updated_run = client.update_generation_run(run_id, update_data)
        if not updated_run:
            click.echo("⚠️  Warning: Failed to update generation run completion", err=True)
        
        # Summary
        click.echo("")
        click.echo("✅ Generation complete!")
        click.echo(f"   Created: {generated_count}/{n_questions} questions")
        click.echo(f"   Generation run ID: {run_id}")
        click.echo("")
        click.echo("📋 Next steps:")
        click.echo(f"   1. View questions in admin UI: /admin/questions")
        click.echo(f"   2. Filter by domain: {domain_code}")
        click.echo(f"   3. Filter by generation_run_id: {run_id}")
        click.echo("")
        
        if generated_count < n_questions:
            click.echo(f"⚠️  Warning: Only {generated_count} of {n_questions} questions were created", err=True)
            sys.exit(1)
        
    except ValueError as ve:
        click.echo(f"❌ Configuration Error: {ve}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"❌ Unexpected error: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
