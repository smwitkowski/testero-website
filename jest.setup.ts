import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);
// All undici and Web API polyfills removed for pure business logic test compatibility.

// Minimal Request polyfill for NextRequest compatibility
// NextRequest extends Request, so Request must exist
if (typeof global.Request === "undefined") {
  // Use a minimal implementation that doesn't conflict with NextRequest
  global.Request = class Request {
    readonly headers!: Headers;
    readonly url!: string;
    readonly method!: string;

    constructor(input: string | Request, init?: RequestInit) {
      const url = typeof input === "string" ? input : input.url;
      const headers = new Headers(init?.headers || (typeof input === "object" && "headers" in input ? input.headers : undefined));
      const method = init?.method || (typeof input === "object" && "method" in input ? input.method : "GET");
      
      // Use Object.defineProperty to make read-only properties
      Object.defineProperty(this, "url", { value: url, writable: false, enumerable: true });
      Object.defineProperty(this, "method", { value: method, writable: false, enumerable: true });
      Object.defineProperty(this, "headers", { value: headers, writable: false, enumerable: true });
    }
  } as any;
}

// Minimal Response polyfill
if (typeof global.Response === "undefined") {
  global.Response = class Response {
    readonly status!: number;
    readonly statusText!: string;
    readonly headers!: Headers;
    readonly body!: ReadableStream | null;
    readonly bodyUsed!: boolean;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      Object.defineProperty(this, "status", { value: init?.status || 200, writable: false });
      Object.defineProperty(this, "statusText", { value: init?.statusText || "", writable: false });
      Object.defineProperty(this, "headers", { value: new Headers(init?.headers), writable: false });
      Object.defineProperty(this, "body", { value: null, writable: false });
      Object.defineProperty(this, "bodyUsed", { value: false, writable: false });
    }

    async json() {
      return {};
    }

    async text() {
      return "";
    }
  } as any;
}

import {
  mockRouter,
  mockSearchParams,
  resetMockRouter,
  resetMockSearchParams,
} from "./__tests__/test-utils/mockNextNavigation";

// Ensure App Router hooks from next/navigation resolve to stable mocks.
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockRouter.pathname,
  useSearchParams: () => mockSearchParams,
  useParams: () => mockRouter.params ?? {},
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

// Set up test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://app.posthog.com";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

// Mock React's cache function for Jest tests
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}));

// Mock Next.js cookies module to avoid request context errors in tests
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(),
  })),
  headers: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    entries: jest.fn(),
    keys: jest.fn(),
    values: jest.fn(),
    forEach: jest.fn(),
  })),
}));

beforeEach(() => {
  resetMockRouter();
  resetMockSearchParams();
});

// Mock IntersectionObserver for Framer Motion animations
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
