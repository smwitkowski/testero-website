# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build for production (includes pre-build SEO generation)
- `npm run start` - Start production server
- `npm run lint` - Run Next.js linting
- `npm test` - Run Jest test suite

### Content and SEO
- `npm run generate:sitemap` - Generate XML sitemaps
- `npm run generate:social-images` - Generate social media images (with GCP storage)
- `npm run generate:seo` - Run both sitemap and social image generation
- `npm run indexnow:submit` - Submit sitemap to search engines

### Testing Commands

#### Jest Unit Tests
- `npm test` - Run all Jest unit tests
- Run single test: `npm test -- --testNamePattern="test name"`
- Run specific test file: `npm test __tests__/filename.test.ts`
- Jest runs with jsdom environment and uses `__tests__/*.test.ts?(x)` pattern

#### Playwright E2E Tests
- `npm run e2e` - Run all E2E tests headlessly
- `npm run e2e:headed` - Run E2E tests with browser visible
- `npm run e2e:ui` - Run E2E tests in interactive UI mode
- `npm run e2e:debug` - Run E2E tests in debug mode with step-by-step execution
- `npm run e2e:report` - View the latest E2E test report
- Run specific test file: `npx playwright test e2e/filename.spec.ts`
- Run single test: `npx playwright test e2e/filename.spec.ts:line_number`

## Architecture Overview

### Technology Stack
- **Next.js 15** with App Router
- **React 18.3** with TypeScript
- **Supabase** for authentication and database (PostgreSQL)
- **shadcn/ui** components with Tailwind CSS
- **PostHog** for analytics
- **Google Cloud Storage** for static assets
- **Playwright** for E2E testing across multiple browsers
- **Jest** with jsdom for unit testing

### Key Directory Structure
```
app/                    # Next.js App Router pages and API routes
├── api/               # API endpoints (diagnostic, auth, questions)
├── diagnostic/        # Diagnostic test pages and session management
├── content/           # Content management system
└── practice/          # Practice question interface

lib/                   # Business logic and utilities
├── auth/             # Authentication handlers (signup, etc.)
├── supabase/         # Database client configuration
├── content/          # Content loading and management
└── seo/              # SEO utilities and metadata generation

components/            # React components
├── ui/               # shadcn/ui base components
├── providers/        # Context providers (Auth, PostHog)
└── content/          # Content-specific components

e2e/                   # End-to-end testing with Playwright
├── helpers/          # Test utilities, page objects, and mock data
└── *.spec.ts         # E2E test files covering user flows

__tests__/             # Jest unit tests
├── *.test.ts         # Unit test files for business logic
```

### Database Architecture (Supabase)
Core tables for diagnostic functionality:
- `diagnostics_sessions` - User diagnostic sessions
- `diagnostic_questions` - Snapshotted questions per session
- `diagnostic_responses` - User answers and scoring
- `questions` - Master question bank
- `exam_versions` - Versioned question sets

### Business Logic Patterns
- **Pure Functions**: Business logic separated from API routes (see `lib/auth/signup-handler.ts`)
- **Type Safety**: Explicit response types with union types for success/error states
- **Rate Limiting**: In-memory rate limiting for signup and other endpoints
- **Session Management**: UUID-based sessions with expiration handling and localStorage persistence
- **Anonymous Users**: Support for anonymous diagnostic sessions with secure session ownership
- **API Mocking**: Comprehensive mocking infrastructure for isolated E2E testing

## Development Guidelines

### TypeScript Response Typing
Always define explicit response types for API handlers:
```typescript
export interface SuccessResponse {
  status: 'ok';
  data?: any;
}

export interface ErrorResponse {
  error: string;
}

export type ResponseBody = SuccessResponse | ErrorResponse;

export interface ApiResponse {
  status: number;
  body: ResponseBody;
}
```

### Styling Guidelines

#### Tailwind CSS Best Practices
- **Prefer Tailwind utility classes** over inline styles for maintainability and consistency
- **Use responsive design patterns** with Tailwind's responsive prefixes (sm:, md:, lg:, xl:)
- **Leverage existing design system** - this project uses shadcn/ui components built on Tailwind CSS
- **Avoid custom CSS** unless absolutely necessary - Tailwind provides comprehensive utilities
- **Component composition**: Use Tailwind classes for layout, spacing, colors, and typography

#### Modern CSS Framework Stack
- **Tailwind CSS** - Primary styling framework (utility-first approach)
- **shadcn/ui** - Pre-built accessible components with Tailwind styling
- **Radix UI** - Unstyled accessible primitives (used internally by shadcn/ui)
- **CSS-in-JS alternatives** like inline styles should be converted to Tailwind classes

#### Example Patterns
```tsx
// ✅ Good - Using Tailwind classes
<div className="max-w-3xl mx-auto my-8 p-6 border border-gray-200 rounded-lg">
  <button className="px-8 py-3 rounded-md font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
    Submit
  </button>
</div>

// ❌ Avoid - Inline styles
<div style={{ maxWidth: 800, margin: "2rem auto", padding: 24 }}>
  <button style={{ padding: "12px 32px", background: "#0070f3" }}>
    Submit
  </button>
</div>
```

### Testing Patterns

#### Unit Testing (Jest)
- Business logic functions should be pure and testable in isolation
- Use type assertions for testing union types: `(res.body as SuccessResponse).status`
- Mock external dependencies consistently in `beforeEach`
- Test both success and error paths
- Tests located in `__tests__/` directory with `.test.ts` extension

#### E2E Testing (Playwright)
- **Page Object Pattern**: Use page objects for maintainable test code (see `e2e/helpers/page-objects/`)
- **Mock API Data**: Use comprehensive mocking via `e2e/helpers/diagnostic-helpers.ts`
- **Cross-browser Testing**: Tests run on Chrome, Firefox, Safari, and Mobile browsers
- **Selector Best Practices**: 
  - Use Playwright's `.first()` method instead of CSS `:first` pseudo-class
  - Prefer role-based selectors when possible: `page.getByRole('button', { name: /submit/i })`
  - Use data-testid attributes for complex selectors when needed
- **Test Organization**: Group related tests in describe blocks, use descriptive test names
- **Async Handling**: Always await page actions and use proper timeout configurations

### Content Management
- Content stored in `app/content/` as Markdown with gray-matter frontmatter
- Dynamic routing for content via `[slug]` pages
- SEO metadata automatically generated from content
- Social images generated and stored in GCP

### Authentication Flow
- **Supabase Auth** with email/password signup and email verification
- **Anonymous diagnostic sessions** supported with `anonymous_session_id`
- **Rate limiting** on auth endpoints (3 requests/minute recommended)
- **PostHog analytics** integration for user events
- **Complete password reset flow** with email confirmation
- **Resend confirmation** functionality for unverified users

### API Route Structure
- Use `app/api/` directory structure
- Separate business logic from route handlers
- Server-side Supabase client for database operations
- Proper error handling with appropriate HTTP status codes

## Deployment

### Environment
- Deployed to Google Cloud Run via Docker
- Artifact Registry for container images
- GitHub Actions CI/CD pipeline
- Next.js standalone output mode for optimal containerization

### Key Build Steps
1. SEO generation (sitemaps, social images) runs in `prebuild`
2. Docker build with multi-stage optimization
3. Cloud Run deployment with 1GB memory, auto-scaling 0-10 instances

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_SITE_URL` (for auth redirects, required for production)
- `USE_GCP_STORAGE` (optional, for social image generation)

## Key Files Reference

### Core Application
- `app/api/diagnostic/route.ts` - Main diagnostic API with session management
- `app/api/diagnostic/session/[id]/status/route.ts` - Session status checking API
- `app/api/diagnostic/summary/[sessionId]/route.ts` - Results summary API
- `app/diagnostic/page.tsx` - Diagnostic start page with resume functionality
- `app/diagnostic/[sessionId]/page.tsx` - Active diagnostic session page
- `app/diagnostic/[sessionId]/summary/page.tsx` - Results summary page

### Business Logic & Configuration
- `lib/auth/signup-handler.ts` - Pure business logic for user signup
- `lib/supabase/client.ts` - Browser Supabase client factory
- `lib/supabase/server.ts` - Server-side Supabase client
- `components/providers/AuthProvider.tsx` - Authentication context with public route support

### Testing Infrastructure
- `jest.config.ts` - Jest configuration with jsdom and module mapping
- `playwright.config.ts` - Playwright E2E testing configuration
- `e2e/helpers/diagnostic-helpers.ts` - E2E test utilities and API mocking
- `e2e/helpers/page-objects/` - Page object classes for maintainable E2E tests

### Build & Deployment
- `cloudbuild.yaml` - Google Cloud Build configuration
- `next.config.mjs` - Next.js config with standalone output and image optimization
- `CLAUDE.md` - This file with development guidelines and architecture documentation

## E2E Testing Guidelines

### Test Structure
- Tests are organized in `e2e/` directory with descriptive filenames
- Each test file covers a specific user flow (e.g., `diagnostic-complete-flow.spec.ts`)
- Use the Page Object pattern for reusable UI interactions
- Mock API responses using `DiagnosticHelpers` class for isolated testing

### Common Issues & Solutions

#### Selector Issues
- **Problem**: `'selector:first' is not a valid selector` 
- **Solution**: Use Playwright's `.first()` method: `page.locator('div').first()`
- **Problem**: Elements not found or timing issues
- **Solution**: Use `await expect(element).toBeVisible({ timeout: 10000 })` for reliable waits

#### Test Isolation
- Each test should be independent and not rely on state from other tests
- Use `beforeEach` hooks to set up clean test state
- Clear localStorage and reset mocks between tests

#### Debugging Tips
- Use `npm run e2e:headed` to see tests run in browser
- Use `npm run e2e:debug` for step-by-step debugging
- Add `await page.pause()` in tests to inspect state
- Check `playwright-report/` for detailed failure information

### Browser Compatibility
- Tests run on Chrome, Firefox, Safari (webkit), and Mobile browsers
- Some features may behave differently across browsers (especially Safari)
- Use browser-specific test skipping if needed: `test.skip(browserName === 'webkit', 'Safari-specific issue')`

## Authentication Patterns

### API Endpoint Standards
All authentication API endpoints should follow these established patterns:

#### Rate Limiting
```typescript
// Standard rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per window

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent);
    return false;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}
```

#### PostHog Analytics Integration
```typescript
// Standard analytics tracking pattern
const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || '', {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
});

// Event naming convention: {action}_{noun}_{status}
posthog.capture({
  event: 'password_reset_requested',
  properties: { email },
  distinctId: email
});
```

#### Input Validation with Zod
```typescript
// Use Zod schemas for all auth endpoints
const authSchema = z.object({
  email: z.string().email(),
  // additional fields...
});

const parse = authSchema.safeParse(body);
if (!parse.success) {
  return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
}
```

#### Response Patterns
```typescript
// Success response
return NextResponse.json({ status: 'ok' }, { status: 200 });

// Error response (avoid leaking sensitive info)
return NextResponse.json({ error: 'Request failed. Please try again.' }, { status: 400 });

// Rate limit response
return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
```

### Authentication Pages Standards

#### Page Structure
- Use consistent layout with `max-w-md` container
- Implement loading, form, success, and error states
- Follow responsive design patterns with `sm:`, `md:`, `lg:` breakpoints
- Use Framer Motion for state transitions

#### Form Validation
- Use `react-hook-form` with Zod resolver for client-side validation
- Real-time validation feedback with green/red states
- Accessible error messages with ARIA attributes

#### State Management
```typescript
type AuthState = 'loading' | 'form' | 'success' | 'error';
const [authState, setAuthState] = useState<AuthState>('loading');
```

### Security Best Practices

#### Environment Variables
- `NEXT_PUBLIC_SITE_URL` required for auth redirects
- Use fallback to `http://localhost:3000` for development only
- Force HTTPS in production environments

#### Error Handling
- Never expose raw Supabase errors to users
- Use generic error messages to prevent information leakage
- Log detailed errors server-side for debugging

#### Rate Limiting
- Implement on ALL auth endpoints (signup currently missing)
- Use Redis for production (in-memory is development only)
- Standard limit: 3 requests per minute per IP

### Known Issues to Address
1. **Signup endpoint**: Rate limiting disabled (security vulnerability)
2. **Login navigation**: Broken link to waitlist instead of signup
3. **Error messages**: Some endpoints leak internal errors
4. **In-memory rate limiting**: Not suitable for production scaling

## Design System Guidelines
- As we make new pages, components, sections, etc. we should revisit these design systems. The design systems are not static, but rather live and grow with the website.