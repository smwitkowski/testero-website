#!/bin/bash
# Script to lint only changed files

set -euo pipefail

# Get the file path from the hook
FILE_PATH="$1"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    echo "File not found: $FILE_PATH"
    exit 0
fi

# Get file extension
EXT="${FILE_PATH##*.}"

# Check if it's a JavaScript or TypeScript file
if [[ "$EXT" =~ ^(js|jsx|ts|tsx)$ ]]; then
    echo "🔍 Running ESLint on $FILE_PATH..."
    
    # Run ESLint and capture output
    if npx eslint "$FILE_PATH" --max-warnings 0; then
        echo "✅ ESLint passed for $FILE_PATH"
    else
        EXIT_CODE=$?
        echo "⚠️  ESLint found issues in $FILE_PATH"
        
        # If it's a fixable issue, offer to fix
        if npx eslint "$FILE_PATH" --fix-dry-run 2>/dev/null | grep -q "fixable"; then
            echo "💡 Some issues can be auto-fixed. Run: npx eslint --fix \"$FILE_PATH\""
        fi
        
        exit $EXIT_CODE
    fi
else
    echo "Skipping ESLint for non-JS/TS file: $FILE_PATH"
fi