#!/bin/bash
# Setup script for running Jest and Playwright tests
set -euo pipefail

if [ ! -d node_modules ]; then
  echo "Installing npm dependencies..."
  npm ci
fi

# Install Playwright browsers if Playwright is available
if npx --no-install playwright --version > /dev/null 2>&1; then
  echo "Installing Playwright browsers..."
  if ! npx playwright install --with-deps; then
    echo "Playwright browser installation failed. You may need to install browsers manually." >&2
  fi
fi

echo "Environment ready. Run 'npm test' for unit tests or 'npm run e2e' for end-to-end tests."
