# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Collaboration Best Practices

### Multi-Issue Project Management
When working on complex projects spanning multiple related issues (3+):

- **Use TodoWrite/TodoRead extensively** for progress tracking and visibility
- **Break down large features** into specific, actionable tasks with clear priorities
- **Work sequentially through todos** - mark as "in_progress" BEFORE starting, complete immediately upon finishing
- **Only have ONE task in_progress** at any time to maintain focus
- **Map dependencies between issues** using descriptive todo content that references related work

### Efficient Tool Usage Patterns
Follow these proven workflows for maximum efficiency:

#### Code Discovery & Implementation Workflow
1. **Grep** → find files containing relevant patterns
2. **Task** → perform complex searches across large codebase  
3. **Read (parallel)** → examine multiple related files simultaneously
4. **MultiEdit** → make coordinated changes across files

#### Git Operations (Always Use Parallel Execution)
```bash
# Run these commands together for complete repository state
git status
git diff  
git log --oneline -10
```

#### Performance Optimizations
- **Use parallel tool calls** whenever examining multiple files or running multiple commands
- **Batch TypeScript checks** with `npx tsc --noEmit` after multiple file changes
- **Target specific test patterns** when debugging: `npm test -- --testNamePattern="auth"`
- **Use selective E2E testing** during development: `npm run e2e -- auth-*.spec.ts`

### Systematic Codebase Exploration
Before implementing new features, always:

1. **Find existing patterns** - Search for similar functionality with Grep/Task
2. **Understand dependencies** - Map related files and imports with parallel Read calls
3. **Check test coverage** - Look for existing test patterns to follow
4. **Review error handling** - Understand established error patterns
5. **Validate security** - Ensure rate limiting and input validation patterns are followed

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

### Testing Strategy & Patterns

#### When to Write Unit vs E2E Tests

**Write Unit Tests For:**
- Pure business logic functions (e.g., `lib/auth/signup-handler.ts`)
- API route handlers with mocked dependencies
- Component validation and form logic
- Utility functions and helper modules

**Write E2E Tests For:**
- Complete user workflows (signup → verification → login → dashboard)
- Cross-browser compatibility requirements
- Authentication state management and route protection
- Form interactions with real DOM elements and navigation
- Integration between multiple system components

#### Unit Testing (Jest)
- Business logic functions should be pure and testable in isolation
- Use type assertions for testing union types: `(res.body as SuccessResponse).status`
- Mock external dependencies consistently in `beforeEach`
- Test both success and error paths extensively
- Tests located in `__tests__/` directory with `.test.ts` extension
- Focus on edge cases: empty inputs, network failures, validation errors

#### E2E Testing (Playwright)
- **Test Helper Classes**: Create reusable helper classes like `AuthHelpers` for common workflows
- **Comprehensive API Mocking**: Mock Supabase auth and internal APIs for consistent test behavior
- **Cross-browser Testing**: Tests run on Chrome, Firefox, Safari, and Mobile browsers
- **Authentication Flows**: Test complete flows including analytics tracking and error scenarios
- **Selector Best Practices**: 
  - Use Playwright's `.first()` method instead of CSS `:first` pseudo-class
  - Prefer role-based selectors: `page.getByRole('button', { name: /submit/i })`
  - Use data-testid attributes for complex selectors when needed
- **Test Organization**: Group related tests in describe blocks with descriptive names
- **Async Handling**: Always await page actions and use proper timeout configurations

#### Test Execution Strategy
- **Development**: Run unit tests frequently (`npm test`)
- **Feature completion**: Run targeted E2E tests (`npm run e2e -- auth-*.spec.ts`)
- **PR preparation**: Full test suite (`npm test && npm run e2e`)
- **Debugging**: Use headed mode (`npm run e2e:headed`) and debug mode (`npm run e2e:debug`)

### Content Management
- Content stored in `app/content/` as Markdown with gray-matter frontmatter
- Dynamic routing for content via `[slug]` pages
- SEO metadata automatically generated from content
- Social images generated and stored in GCP

### Authentication System Architecture

#### Complete User Flows
- **Signup Flow**: `/api/auth/signup` → email verification → dashboard access
- **Guest Upgrade**: Anonymous sessions preserved during signup process  
- **Password Reset**: Forgot password → email → reset form → login with new password
- **Login Flow**: Email/password → unconfirmed email warnings → resend functionality
- **Route Protection**: Early access controls + authentication state guards

#### Core Components
- **Supabase Auth** with email/password signup and email verification
- **Anonymous diagnostic sessions** supported with `anonymous_session_id` cookie storage
- **Guest session upgrade** - preserves diagnostic history when anonymous users sign up
- **Rate limiting** on all auth endpoints (3 requests/minute recommended)
- **PostHog analytics** integration for user behavior tracking
- **Complete password reset flow** with secure token validation
- **Resend confirmation** functionality for unverified users

#### Database Schema Relationships
```sql
-- Users table (managed by Supabase Auth)
auth.users (
  id uuid PRIMARY KEY,
  email text,
  email_confirmed_at timestamp,
  user_metadata jsonb  -- Contains is_early_access boolean
)

-- Anonymous sessions for guest users
public.anonymous_sessions (
  id uuid PRIMARY KEY,
  created_at timestamp,
  session_data jsonb
)

-- Links anonymous sessions to authenticated users after signup
public.user_sessions (
  user_id uuid REFERENCES auth.users(id),
  anonymous_session_id uuid,
  upgraded_at timestamp
)
```

#### Security Patterns
- **Rate limiting on ALL auth endpoints** (signup, login, password reset, resend)
- **Generic error messages** - never expose raw Supabase errors to users
- **HTTPS enforcement** with proper redirect URL configuration
- **Input validation** using Zod schemas for all auth endpoints
- **Session security** with secure cookie storage and expiration handling

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

## Git Workflow & Collaboration Standards

### Branch Naming Convention
- Use descriptive branch names: `TES-XXX-brief-description`
- Reference Linear issue IDs when applicable
- Keep branch names concise but meaningful

### Commit Message Standards
Follow this proven format for clear, comprehensive commits:

```
TES-XXX: Brief description of change

• Specific implementation details with bullet points
• Technical considerations and trade-offs made  
• Testing approach and coverage added
• Security implications addressed (if applicable)

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Git Operations Best Practices
- **Always use parallel git commands** for efficiency:
  ```bash
  git status
  git diff
  git log --oneline -10
  ```
- **Atomic commits** - each commit should represent a complete, logical change
- **Run linting and TypeScript checks** before committing: `npm run lint && npx tsc --noEmit`
- **Test relevant functionality** before pushing: target specific test patterns when possible

### Pull Request Documentation
Include in every PR:
- **Summary**: What was implemented and why
- **Technical Details**: Architecture decisions and patterns used
- **Test Coverage**: Unit and E2E tests added/modified
- **Security Review**: Rate limiting, error handling, input validation addressed
- **Performance Impact**: Any considerations for scale/speed

## Linear Project Management for Claude Code Agents

### MCP-Based Issue Management Workflows

#### Issue Creation & Updates (Primary Agent Functions)
```typescript
// Create structured issues with required fields
await mcp__linear__linear_createIssue({
  title: "Clear, actionable title without user story format",
  description: "Technical implementation details with acceptance criteria",
  teamId: "d2118062-2bb1-4680-a81f-ce62b404b7a5", // Testero team
  priority: 1-4, // 1=Urgent, 2=High, 3=Medium, 4=Low  
  estimate: 1-8, // Story points or hours
  labelIds: ["dd989130-9606-4b0b-b0b4-47393fad688f"], // Bug label ID
  projectId: "project-uuid", // Link to parent project
  stateId: "c8bd6f5b-12cf-49b1-8c53-34a58afcfb3a" // Backlog state
});

// Update issue progress programmatically
await mcp__linear__linear_updateIssue({
  id: "issue-uuid",
  stateId: "67197f8c-e8a9-46bb-9450-7679a3eb8ffa", // In Progress
  assigneeId: "095911f2-65ad-4465-9884-3fbb36541549", // Stephen
  priority: 2 // Escalate to High priority
});
```

#### Issue Organization Patterns
- **Title Format**: `[Component] Action - Brief description` (e.g., "Auth API: Add rate limiting to signup endpoint")
- **Priority Assignment**: Use numeric priorities (1-4) based on impact × urgency matrix
- **Label Strategy**: Component-based (`auth`, `diagnostic`, `ui`) + type (`bug`, `feature`, `improvement`)
- **State Transitions**: Backlog → Todo → In Progress → Done (skip states for efficiency)

### Project Structure & Planning Automation

#### Project Creation & Management
```typescript
// Create projects for 5-20 related issues
await mcp__linear__linear_createProject({
  name: "Authentication Security Improvements",
  description: "Critical security fixes identified in audit",
  state: "planned", // planned, started, paused, completed, canceled
  teamIds: ["d2118062-2bb1-4680-a81f-ce62b404b7a5"]
});

// Query project status for planning
const projects = await mcp__linear__linear_getProjects();
const activeProjects = projects.filter(p => p.state === "started");
```

#### Issue-Project Relationships
- **Project Scope**: 2-4 week deliverable with clear success metrics
- **Issue Breakdown**: Large features split into 2-5 day implementation tasks
- **Dependencies**: Use `createIssueRelation` with `blocks`/`blocked_by` types
- **Sub-tasks**: Convert related issues to sub-tasks with `convertIssueToSubtask`

### Cycle & Sprint Management

#### Cycle Planning Automation
```typescript
// Get active cycle for planning
const activeCycle = await mcp__linear__linear_getActiveCycle({
  teamId: "d2118062-2bb1-4680-a81f-ce62b404b7a5"
});

// Add issues to cycle based on priority/capacity
await mcp__linear__linear_addIssueToCycle({
  issueId: "high-priority-issue-uuid",
  cycleId: activeCycle.id
});
```

#### Capacity Planning Rules
- **2-week cycles**: 15-25 story points per developer
- **Estimation accuracy**: Track velocity over 3+ cycles for reliable planning
- **Buffer allocation**: Reserve 20% capacity for urgent bugs and technical debt
- **Cross-project balance**: Limit work-in-progress to 2-3 projects per cycle

### Programmatic Workflow Automation

#### Issue Lifecycle Automation
```typescript
// Auto-assign and progress issues
await mcp__linear__linear_assignIssue({
  issueId: "uuid",
  assigneeId: "095911f2-65ad-4465-9884-3fbb36541549"
});

await mcp__linear__linear_updateIssue({
  id: "uuid", 
  stateId: "67197f8c-e8a9-46bb-9450-7679a3eb8ffa" // In Progress
});

// Add contextual labels based on content
await mcp__linear__linear_addIssueLabel({
  issueId: "uuid",
  labelId: "dd989130-9606-4b0b-b0b4-47393fad688f" // Bug label
});
```

#### Search & Filtering Patterns
```typescript
// Find issues by criteria for batch operations
const authIssues = await mcp__linear__linear_searchIssues({
  query: "auth authentication signup login",
  teamId: "d2118062-2bb1-4680-a81f-ce62b404b7a5",
  states: ["Backlog", "Todo"]
});

// Priority-based triage
const urgentBugs = await mcp__linear__linear_searchIssues({
  query: "bug error",
  states: ["Todo", "In Progress"],
  limit: 10
});
```

### Agent Decision Trees for Issue Management

#### Issue Creation Logic
1. **Analyze request** → Determine issue type (bug/feature/improvement)
2. **Check existing issues** → Search for duplicates before creating
3. **Project assignment** → Link to appropriate project or create new one
4. **Priority calculation** → Assign based on impact (user-facing, security, performance)
5. **Estimation** → Use complexity indicators (API changes=5-8, UI updates=2-3, config=1-2)

#### Batch Operations for Efficiency
```typescript
// Process multiple issues in sequence
const issueUpdates = backlogIssues.map(issue => ({
  id: issue.id,
  priority: calculatePriority(issue.description),
  stateId: triageState(issue.labels)
}));

for (const update of issueUpdates) {
  await mcp__linear__linear_updateIssue(update);
}
```

### Quality Control & Metrics

#### Issue Quality Standards
- **Title clarity**: Specific action + component (not user stories)
- **Description structure**: Problem + proposed solution + acceptance criteria
- **Estimation consistency**: Use Fibonacci sequence (1,2,3,5,8) for complexity
- **Label completeness**: Every issue has component + type labels
- **Project linkage**: All issues belong to a project (create if needed)

#### Progress Tracking Patterns
```typescript
// Calculate project completion
const projectIssues = await mcp__linear__linear_getProjectIssues({
  projectId: "uuid",
  limit: 100
});

const completedIssues = projectIssues.filter(i => i.state.type === "completed");
const completionRate = completedIssues.length / projectIssues.length;
```

This agent-optimized approach focuses on programmatic operations, structured data patterns, and automated workflows rather than UI interactions.

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

## Debugging & Troubleshooting Workflows

### TypeScript Compilation Errors
1. Run `npx tsc --noEmit` to see all errors at once
2. Fix import/export issues first (affects other files)
3. Address type mismatches in order of complexity
4. Verify fixes with incremental compilation

### E2E Test Failures
1. **Run with headed browser**: `npm run e2e:headed` to see what's happening
2. **Add debug breakpoints**: `await page.pause()` at failure point
3. **Check element selectors**: Use `npm run e2e:debug` for step-by-step execution
4. **Verify API mocking**: Ensure all required endpoints are properly mocked
5. **Cross-browser issues**: Test with different browsers if behavior varies

### API Route Issues
1. **Test endpoints directly**: Use curl/Postman before writing tests
2. **Check rate limiting**: Verify implementation doesn't block legitimate requests
3. **Supabase client config**: Review server vs client configuration
4. **Error handling**: Ensure proper response formats and status codes
5. **Edge case testing**: Invalid input, network failures, timeout scenarios

### Git Workflow Issues
- **Merge conflicts**: Use VS Code merge editor for complex conflicts
- **Branch synchronization**: `git fetch origin && git rebase origin/main`
- **Commit history**: Use `git log --oneline --graph` for visualization
- **Large commits**: Consider `git add -p` for partial staging

### Performance Investigation
- **Slow tests**: Use `npm run e2e:headed` to identify bottlenecks
- **Build issues**: Check `npm run build` output for optimization opportunities
- **Memory usage**: Monitor with `npm run dev` and browser DevTools

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