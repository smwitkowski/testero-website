import "@testing-library/jest-dom";
// All undici and Web API polyfills removed for pure business logic test compatibility.

// Mock React's cache function for Jest tests
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: any) => fn,
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
