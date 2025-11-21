# Justfile for Testero Frontend

# Run all CI checks (lint, eslint-rules, type-check)
ci:
    npm run lint
    npm run test:eslint-rules
    npx tsc --noEmit -p tsconfig.build.json

# Run ESLint
lint:
    npm run lint

# Run ESLint with auto-fix
lint-fix:
    npm run lint:fix

# Run ESLint rule tests
test-eslint-rules:
    npm run test:eslint-rules

# Run TypeScript type check
type-check:
    npx tsc --noEmit -p tsconfig.build.json

# Run Jest unit tests
test:
    npm test

# Run Jest tests in CI mode
test-ci:
    npm run test:ci

# Run Playwright E2E tests
e2e:
    npm run e2e

# Run Playwright E2E tests in CI mode
e2e-ci:
    npm run e2e:ci

# Run Playwright E2E tests with UI
e2e-ui:
    npm run e2e:ui

# Run Playwright E2E tests in headed mode
e2e-headed:
    npm run e2e:headed

# Build for production
build:
    npm run build

# Start development server
dev:
    npm run dev

# Start production server
start:
    npm run start

# Generate SEO assets (sitemap + social images)
generate-seo:
    npm run generate:seo

# Validate content
validate-content:
    npm run validate:content

# Run design lints
lint-design:
    npm run lint:design

