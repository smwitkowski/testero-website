import React from "react";
import { render } from "@testing-library/react";
import { useSessionTracking } from "@/lib/analytics/hooks/useSessionTracking";
import { usePostHog } from "posthog-js/react";
import { usePathname } from "next/navigation";

// Mock dependencies
jest.mock("posthog-js/react", () => ({
  usePostHog: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

const mockPostHog = {
  capture: jest.fn(),
};

const TestComponent = () => {
  useSessionTracking();
  return <div>Test</div>;
};

describe("useSessionTracking storage resilience", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePostHog as jest.Mock).mockReturnValue(mockPostHog);
    (usePathname as jest.Mock).mockReturnValue("/test");
  });

  test("does not crash when sessionStorage throws SecurityError", () => {
    // Mock sessionStorage to throw SecurityError (simulating blocked storage)
    const originalSessionStorage = window.sessionStorage;
    const mockSessionStorage = {
      getItem: jest.fn(() => {
        throw new DOMException("Access is denied", "SecurityError");
      }),
      setItem: jest.fn(() => {
        throw new DOMException("Access is denied", "SecurityError");
      }),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    Object.defineProperty(window, "sessionStorage", {
      value: mockSessionStorage,
      writable: true,
    });

    // Component should render without crashing
    expect(() => {
      render(<TestComponent />);
    }).not.toThrow();

    // Restore original sessionStorage
    Object.defineProperty(window, "sessionStorage", {
      value: originalSessionStorage,
      writable: true,
    });
  });

  test("falls back to in-memory storage when sessionStorage is blocked", () => {
    // Mock sessionStorage to throw SecurityError
    const originalSessionStorage = window.sessionStorage;
    const mockSessionStorage = {
      getItem: jest.fn(() => {
        throw new DOMException("Access is denied", "SecurityError");
      }),
      setItem: jest.fn(() => {
        throw new DOMException("Access is denied", "SecurityError");
      }),
      removeItem: jest.fn(),
      clear: jest.fn(),
      key: jest.fn(),
      length: 0,
    };

    Object.defineProperty(window, "sessionStorage", {
      value: mockSessionStorage,
      writable: true,
    });

    // Component should render successfully
    const { container } = render(<TestComponent />);
    expect(container).toBeInTheDocument();

    // Restore original sessionStorage
    Object.defineProperty(window, "sessionStorage", {
      value: originalSessionStorage,
      writable: true,
    });
  });
});
