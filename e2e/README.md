# E2E Testing with Playwright

This directory contains end-to-end tests for the diagnostic flow using Playwright.

## Setup

Playwright is configured to run tests against the local development server at `http://localhost:3000`.

### Installation

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### Running Tests

```bash
# Run all E2E tests
npm run e2e

# Run tests with UI mode for debugging
npm run e2e:ui

# Run tests in headed mode (visible browser)
npm run e2e:headed

# Run specific test file
npm run e2e e2e/diagnostic-complete-flow.spec.ts

# Debug specific test
npm run e2e:debug e2e/diagnostic-complete-flow.spec.ts
```

## Test Structure

### Test Files

- `diagnostic-complete-flow.spec.ts` - Complete diagnostic flow from start to summary
- `diagnostic-session-resume.spec.ts` - Session persistence and resume functionality
- `diagnostic-start-over.spec.ts` - Start over functionality and localStorage cleanup
- `diagnostic-url-access.spec.ts` - Direct URL access scenarios and error handling
- `diagnostic-user-types.spec.ts` - Anonymous user flows and PostHog tracking
- `diagnostic-session-expiration.spec.ts` - Session expiration and cleanup scenarios

### Helper Files

- `helpers/diagnostic-helpers.ts` - Shared utilities for API mocking and localStorage management
- `helpers/mock-data.ts` - Mock API responses and test data
- `helpers/page-objects/` - Page Object Model classes for maintainable tests

### Page Objects

- `DiagnosticStartPage.ts` - Start page interactions and validations
- `DiagnosticQuestionPage.ts` - Question page interactions and answer submission
- `DiagnosticSummaryPage.ts` - Summary page validations and score verification

## Test Coverage

### ✅ Complete Diagnostic Flow
- Start diagnostic with exam selection
- Answer questions sequentially  
- Submit answers and view feedback
- Navigate to summary page
- Verify score calculation and display

### ✅ Session Persistence
- Store session ID in localStorage
- Resume unfinished diagnostics
- Handle page refreshes during sessions
- Clean up expired/completed sessions

### ✅ Start Over Functionality
- Clear session data when starting over
- Allow new diagnostic after start over
- Handle multiple start over actions

### ✅ Error Handling
- Invalid session IDs
- Expired sessions
- Unauthorized access
- Network errors
- Malformed data

### ✅ Anonymous User Support
- Anonymous session management
- PostHog event tracking
- Session ownership validation
- Cross-browser session handling

## API Mocking

Tests use comprehensive API mocking to ensure:
- Consistent test data
- Isolated test execution
- No external dependencies
- Predictable test results

Mocked endpoints:
- `POST /api/diagnostic` (start, answer, complete actions)
- `GET /api/diagnostic` (session fetching)
- `GET /api/diagnostic/session/[id]/status` (session status)
- `GET /api/diagnostic/summary/[id]` (results summary)
- PostHog analytics endpoints

## Configuration

Playwright is configured in `playwright.config.ts` with:
- Multi-browser support (Chrome, Firefox, Safari)
- Mobile device testing
- Automatic dev server startup
- Screenshot/video capture on failures
- Retry logic for flaky tests
- HTML test reports

## Best Practices

1. **Page Object Pattern** - Maintainable test code with reusable components
2. **API Mocking** - Isolated tests with predictable data
3. **Waiting Strategies** - Proper waits for page loads and state changes
4. **Error Handling** - Graceful handling of localStorage access issues
5. **Test Data** - Consistent mock data for reliable test execution

## Debugging

When tests fail:
1. Check screenshots in `test-results/`
2. View videos of test execution
3. Use `npm run e2e:ui` for interactive debugging
4. Use `npm run e2e:debug` to step through tests
5. Check trace files with `npx playwright show-trace`

## CI/CD Integration

Tests are designed to run in CI environments with:
- Headless browser execution
- Artifact collection on failures
- Parallel test execution
- Automatic retry on flaky tests