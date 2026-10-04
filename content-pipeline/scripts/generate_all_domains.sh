#!/bin/bash
# Generate 3 questions for each domain, subsection, and difficulty level combination

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# Function to get subsections for a domain
get_subsections() {
    case "$1" in
        "ARCHITECTING_LOW_CODE_ML_SOLUTIONS")
            echo "1.1 1.2 1.3"
            ;;
        "COLLABORATING_TO_MANAGE_DATA_AND_MODELS")
            echo "2.1 2.2 2.3"
            ;;
        "SCALING_PROTOTYPES_INTO_ML_MODELS")
            echo "3.1 3.2 3.3"
            ;;
        "SERVING_AND_SCALING_MODELS")
            echo "4.1 4.2"
            ;;
        "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES")
            echo "5.1 5.2 5.3"
            ;;
        "MONITORING_ML_SOLUTIONS")
            echo "6.1 6.2"
            ;;
    esac
}

# All PMLE domains (in order)
DOMAINS=(
    "ARCHITECTING_LOW_CODE_ML_SOLUTIONS"
    "COLLABORATING_TO_MANAGE_DATA_AND_MODELS"
    "SCALING_PROTOTYPES_INTO_ML_MODELS"
    "SERVING_AND_SCALING_MODELS"
    "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES"
    "MONITORING_ML_SOLUTIONS"
)

# All difficulty levels
DIFFICULTIES=("EASY" "MEDIUM" "HARD")

# Questions per difficulty level per subsection
QUESTIONS_PER_COMBINATION=3

# Calculate total subsections across all domains
TOTAL_SUBSECTIONS=0
for domain in "${DOMAINS[@]}"; do
    subsections=($(get_subsections "$domain"))
    TOTAL_SUBSECTIONS=$((TOTAL_SUBSECTIONS + ${#subsections[@]}))
done

# Total calculations
TOTAL_DOMAINS=${#DOMAINS[@]}
TOTAL_DIFFICULTIES=${#DIFFICULTIES[@]}
TOTAL_COMBINATIONS=$((TOTAL_SUBSECTIONS * TOTAL_DIFFICULTIES))
TOTAL_QUESTIONS=$((TOTAL_COMBINATIONS * QUESTIONS_PER_COMBINATION))

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PMLE Question Generation - All Domains${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Configuration:"
echo "  Domains: $TOTAL_DOMAINS"
echo "  Subsections: $TOTAL_SUBSECTIONS"
echo "  Difficulty levels: $TOTAL_DIFFICULTIES"
echo "  Questions per combination: $QUESTIONS_PER_COMBINATION"
echo "  Total combinations: $TOTAL_COMBINATIONS (subsections × difficulties)"
echo "  Total questions to generate: $TOTAL_QUESTIONS"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Track progress
COMBINATION_COUNT=0
SUCCESS_COUNT=0
FAILED_COUNT=0
declare -a FAILED_COMBINATIONS

# Start time
START_TIME=$(date +%s)

# Loop through each domain
for domain in "${DOMAINS[@]}"; do
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Domain: $domain${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Get subsections for this domain
    subsections=($(get_subsections "$domain"))
    
    # Loop through each subsection
    for subsection in "${subsections[@]}"; do
        echo ""
        echo -e "${BLUE}  Subsection: $subsection${NC}"
        
        # Loop through each difficulty level
        for difficulty in "${DIFFICULTIES[@]}"; do
            COMBINATION_COUNT=$((COMBINATION_COUNT + 1))
            
            echo ""
            echo -e "${YELLOW}[$COMBINATION_COUNT/$TOTAL_COMBINATIONS]${NC} Generating $QUESTIONS_PER_COMBINATION questions"
            echo -e "    Domain: $domain"
            echo -e "    Subsection: $subsection"
            echo -e "    Difficulty: $difficulty"
            
            # Run the generation script
            # Note: --subsection parameter support needs to be added to generate_pmle_questions.py
            if python3 "$SCRIPT_DIR/generate_pmle_questions.py" \
                --domain-code "$domain" \
                --n-questions "$QUESTIONS_PER_COMBINATION" \
                --difficulty "$difficulty"; then
                SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
                echo -e "${GREEN}✓ Successfully generated questions for $domain / $subsection ($difficulty)${NC}"
            else
                FAILED_COUNT=$((FAILED_COUNT + 1))
                FAILED_COMBINATIONS+=("$domain / $subsection ($difficulty)")
                echo -e "${YELLOW}⚠ Failed to generate questions for $domain / $subsection ($difficulty)${NC}"
            fi
            
            # Small delay to avoid rate limiting
            sleep 1
        done
    done
done

# Calculate elapsed time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

# Final summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Generation Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Summary:"
echo "  Total combinations: $TOTAL_COMBINATIONS"
echo "  Successful: $SUCCESS_COUNT"
echo "  Failed: $FAILED_COUNT"
echo "  Time elapsed: ${MINUTES}m ${SECONDS}s"
echo ""

if [ $FAILED_COUNT -gt 0 ]; then
    echo "Failed combinations:"
    for combo in "${FAILED_COMBINATIONS[@]}"; do
        echo "  - $combo"
    done
    echo ""
fi

if [ $FAILED_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All generations completed successfully!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some generations failed. Check the output above for details.${NC}"
    exit 1
fi
