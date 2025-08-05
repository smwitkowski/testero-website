#!/bin/bash
# Script to run TypeScript type checking with better output

set -euo pipefail

# Get the file path from the hook (optional)
FILE_PATH="${1:-}"

# Function to format TypeScript errors
format_ts_errors() {
    # Color codes
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
    
    # Parse and format TypeScript output
    sed -E "s/^(.+)\(([0-9]+),([0-9]+)\): error (TS[0-9]+): (.+)$/${RED}Error${NC} ${BLUE}\1${NC}:${YELLOW}\2:\3${NC} - \5 (${RED}\4${NC})/"
}

echo "🔍 Checking TypeScript types..."

# Run TypeScript compiler
if npx tsc --noEmit --pretty false 2>&1 | format_ts_errors; then
    echo "✅ TypeScript check passed"
else
    EXIT_CODE=$?
    echo ""
    echo "⚠️  TypeScript found type errors"
    echo "💡 Fix the errors above and run 'npx tsc --noEmit' to verify"
    
    # If a specific file was passed, show only errors for that file
    if [ -n "$FILE_PATH" ] && [ -f "$FILE_PATH" ]; then
        echo ""
        echo "Errors in $FILE_PATH:"
        npx tsc --noEmit --pretty false 2>&1 | grep "$FILE_PATH" | format_ts_errors || true
    fi
    
    exit $EXIT_CODE
fi