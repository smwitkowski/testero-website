#!/usr/bin/env python3
"""Generate questions for all domains and difficulty levels.

This script runs the question generation pipeline for each domain and difficulty
level combination, generating 3 questions per combination by default.
"""

import sys
import subprocess
import time
from pathlib import Path
from typing import List, Tuple, Dict

import click

# Add parent directory to path to import shared modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.domain_context import PMLE_DOMAIN_CONTEXT


def run_generation(
    domain_code: str,
    subsection_code: str | None,
    difficulty: str,
    n_questions: int = 3,
    dry_run: bool = False,
    skip_eval: bool = False,
) -> Tuple[bool, str]:
    """Run question generation for a specific domain, subsection, and difficulty.
    
    Args:
        domain_code: Domain code (e.g., "ARCHITECTING_LOW_CODE_ML_SOLUTIONS")
        subsection_code: Subsection code (e.g., "1.1", "2.3") or None for domain-level
        difficulty: Difficulty level ("EASY", "MEDIUM", "HARD")
        n_questions: Number of questions to generate
        dry_run: If True, run without inserting into database
        skip_eval: If True, skip factual accuracy evaluation
        
    Returns:
        Tuple of (success: bool, output: str)
    """
    script_path = Path(__file__).parent / "generate_pmle_questions.py"
    
    cmd = [
        sys.executable,
        str(script_path),
        "--domain-code", domain_code,
        "--n-questions", str(n_questions),
        "--difficulty", difficulty,
    ]
    
    if subsection_code:
        cmd.extend(["--subsection", subsection_code])
    
    if dry_run:
        cmd.append("--dry-run")
    if skip_eval:
        cmd.append("--skip-eval")
    
    try:
        result = subprocess.run(
            cmd,
            check=True,
        )
        return True, ""
    except subprocess.CalledProcessError as e:
        return False, f"Exit code: {e.returncode}"


@click.command()
@click.option(
    "--n-questions",
    default=3,
    type=int,
    help="Number of questions to generate per domain/difficulty combination (default: 3)",
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Generate questions without inserting into database",
)
@click.option(
    "--skip-eval",
    is_flag=True,
    help="Skip factual accuracy evaluation (faster but less accurate)",
)
@click.option(
    "--domains",
    multiple=True,
    help="Specific domains to generate (default: all domains). Can be specified multiple times.",
)
@click.option(
    "--difficulties",
    multiple=True,
    type=click.Choice(["EASY", "MEDIUM", "HARD"], case_sensitive=False),
    help="Specific difficulties to generate (default: all difficulties). Can be specified multiple times.",
)
@click.option(
    "--subsections",
    multiple=True,
    help="Specific subsections to generate (default: all subsections). Can be specified multiple times (e.g., '1.1', '2.3').",
)
@click.option(
    "--skip-until",
    help="Skip all combinations until reaching the specified one. Format: DOMAIN:SUBSECTION:DIFFICULTY (e.g., 'SCALING_PROTOTYPES_INTO_ML_MODELS:3.1:EASY'). Starts processing from this combination onwards.",
)
def main(
    n_questions: int,
    dry_run: bool,
    skip_eval: bool,
    domains: Tuple[str, ...],
    difficulties: Tuple[str, ...],
    subsections: Tuple[str, ...],
    skip_until: str | None,
):
    """Generate questions for all domains, subsections, and difficulty levels.
    
    By default, generates 3 questions for each domain/subsection/difficulty combination.
    This will create 6 domains × 16 subsections × 3 difficulties × 3 questions = 864 questions total.
    """
    # Get domains to process
    if domains:
        domain_list = list(domains)
        # Validate domains
        invalid_domains = [d for d in domain_list if d not in PMLE_DOMAIN_CONTEXT]
        if invalid_domains:
            click.echo(f"Error: Invalid domain codes: {', '.join(invalid_domains)}", err=True)
            click.echo(f"Valid domains: {', '.join(PMLE_DOMAIN_CONTEXT.keys())}", err=True)
            sys.exit(1)
    else:
        domain_list = list(PMLE_DOMAIN_CONTEXT.keys())
    
    # Get difficulties to process
    if difficulties:
        difficulty_list = [d.upper() for d in difficulties]
    else:
        difficulty_list = ["EASY", "MEDIUM", "HARD"]
    
    # Build subsection list per domain
    domain_subsection_map: Dict[str, List[str]] = {}
    for domain_code in domain_list:
        domain_subsections = list(PMLE_DOMAIN_CONTEXT[domain_code].get("subsections", {}).keys())
        if subsections:
            # Filter to requested subsections
            filtered_subsections = [s for s in domain_subsections if s in subsections]
            if filtered_subsections:
                domain_subsection_map[domain_code] = filtered_subsections
            else:
                # If no matching subsections, use None to generate at domain level
                domain_subsection_map[domain_code] = [None]
        else:
            # Use all subsections for this domain
            domain_subsection_map[domain_code] = domain_subsections if domain_subsections else [None]
    
    # Calculate totals
    total_combinations = sum(len(subs) * len(difficulty_list) for subs in domain_subsection_map.values())
    total_questions = total_combinations * n_questions
    
    # Display configuration
    click.echo("=" * 50)
    click.echo("PMLE Question Generation - All Domains")
    click.echo("=" * 50)
    click.echo("")
    click.echo("Configuration:")
    click.echo(f"  Domains: {len(domain_list)}")
    total_subsections = sum(len(subs) for subs in domain_subsection_map.values())
    click.echo(f"  Subsections: {total_subsections} (across all domains)")
    click.echo(f"  Difficulty levels: {len(difficulty_list)}")
    click.echo(f"  Questions per combination: {n_questions}")
    click.echo(f"  Total combinations: {total_combinations}")
    click.echo(f"  Total questions to generate: {total_questions}")
    if dry_run:
        click.echo("  Mode: DRY RUN (no database insertion)")
    if skip_eval:
        click.echo("  Mode: SKIP EVAL (no factual accuracy check)")
    click.echo("")
    
    if not dry_run:
        click.confirm("Proceed with generation?", abort=True)
    
    # Parse skip_until if provided
    skip_until_tuple: Tuple[str, str | None, str] | None = None
    if skip_until:
        parts = skip_until.split(":")
        if len(parts) != 3:
            click.echo(f"Error: --skip-until must be in format DOMAIN:SUBSECTION:DIFFICULTY (e.g., 'SCALING_PROTOTYPES_INTO_ML_MODELS:3.1:EASY')", err=True)
            sys.exit(1)
        domain_part, subsection_part, difficulty_part = parts
        skip_domain = domain_part.strip()
        skip_subsection = subsection_part.strip() if subsection_part.strip() and subsection_part.strip().lower() != "none" else None
        skip_difficulty = difficulty_part.strip().upper()
        
        # Validate
        if skip_domain not in PMLE_DOMAIN_CONTEXT:
            click.echo(f"Error: Invalid domain in --skip-until: {skip_domain}", err=True)
            click.echo(f"Valid domains: {', '.join(PMLE_DOMAIN_CONTEXT.keys())}", err=True)
            sys.exit(1)
        if skip_difficulty not in ["EASY", "MEDIUM", "HARD"]:
            click.echo(f"Error: Invalid difficulty in --skip-until: {skip_difficulty}. Must be EASY, MEDIUM, or HARD", err=True)
            sys.exit(1)
        
        skip_until_tuple = (skip_domain, skip_subsection, skip_difficulty)
        click.echo(f"⏭️  Skipping until: {skip_domain} / {skip_subsection or 'domain-level'} / {skip_difficulty}")
        click.echo("")
    
    # Track progress
    combination_count = 0
    success_count = 0
    failed_count = 0
    failed_combinations: List[Tuple[str, str | None, str]] = []
    skipping = skip_until_tuple is not None
    
    start_time = time.time()
    
    # Loop through each domain
    for domain_code in domain_list:
        domain_name = PMLE_DOMAIN_CONTEXT[domain_code]["display_name"]
        domain_subsections = domain_subsection_map[domain_code]
        
        click.echo("")
        click.echo("-" * 50)
        click.echo(f"Domain: {domain_name} ({domain_code})")
        click.echo("-" * 50)
        
        # Loop through each subsection (or None for domain-level)
        for subsection_code in domain_subsections:
            # Loop through each difficulty level
            for difficulty in difficulty_list:
                combination_count += 1
                
                # Check if we should skip this combination
                if skipping:
                    current_tuple = (domain_code, subsection_code, difficulty)
                    if current_tuple == skip_until_tuple:
                        skipping = False
                        click.echo("")
                        click.echo("▶️  Reached skip-until point, starting generation from here...")
                        click.echo("")
                    else:
                        click.echo(f"⏭️  Skipping [{combination_count}/{total_combinations}] {domain_name} / {subsection_code or 'domain-level'} / {difficulty}")
                        continue
                
                subsection_label = subsection_code if subsection_code else "domain-level"
                click.echo("")
                click.echo(
                    f"[{combination_count}/{total_combinations}] "
                    f"Generating {n_questions} questions for {domain_name} "
                    f"(Subsection: {subsection_label}, Difficulty: {difficulty})"
                )
                
                # Run generation
                success, output = run_generation(
                    domain_code=domain_code,
                    subsection_code=subsection_code,
                    difficulty=difficulty,
                    n_questions=n_questions,
                    dry_run=dry_run,
                    skip_eval=skip_eval,
                )
                
                if success:
                    success_count += 1
                    click.echo(f"✓ Successfully generated questions for {domain_name} ({subsection_label}, {difficulty})")
                else:
                    failed_count += 1
                    failed_combinations.append((domain_code, subsection_code, difficulty))
                    click.echo(f"⚠ Failed to generate questions for {domain_name} ({subsection_label}, {difficulty})", err=True)
                    if output:
                        click.echo(f"Error: {output}", err=True)
                
                # Small delay to avoid rate limiting
                time.sleep(1)
    
    # Calculate elapsed time
    elapsed = time.time() - start_time
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)
    
    # Final summary
    click.echo("")
    click.echo("=" * 50)
    click.echo("Generation Complete")
    click.echo("=" * 50)
    click.echo("")
    click.echo("Summary:")
    click.echo(f"  Total combinations: {total_combinations}")
    click.echo(f"  Successful: {success_count}")
    click.echo(f"  Failed: {failed_count}")
    click.echo(f"  Time elapsed: {minutes}m {seconds}s")
    click.echo("")
    
    if failed_combinations:
        click.echo("Failed combinations:")
        for domain_code, subsection_code, difficulty in failed_combinations:
            domain_name = PMLE_DOMAIN_CONTEXT[domain_code]["display_name"]
            subsection_label = subsection_code if subsection_code else "domain-level"
            click.echo(f"  - {domain_name} (Subsection: {subsection_label}, Difficulty: {difficulty})")
        click.echo("")
    
    if failed_count == 0:
        click.echo("✓ All generations completed successfully!")
        sys.exit(0)
    else:
        click.echo("⚠ Some generations failed. Check the output above for details.", err=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
