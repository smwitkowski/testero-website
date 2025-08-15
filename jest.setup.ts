import "@testing-library/jest-dom";
// All undici and Web API polyfills removed for pure business logic test compatibility.

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
  cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
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

// Mock IntersectionObserver for Framer Motion animations
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
