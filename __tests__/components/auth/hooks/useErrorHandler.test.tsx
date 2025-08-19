/** @jest-environment jsdom */

import { renderHook, act } from "@testing-library/react";
import { useErrorHandler } from "@/components/auth/hooks/useErrorHandler";

// Mock useRouter
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("useErrorHandler", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  test("triggers retry action", () => {
    const mockRetry = jest.fn();
    const { result } = renderHook(() =>
      useErrorHandler({
        onRetry: mockRetry,
      })
    );

    expect(result.current.canRetry).toBe(true);

    act(() => {
      result.current.triggerRetry();
    });

    expect(mockRetry).toHaveBeenCalled();
  });

  test("triggers redirect action", () => {
    const { result } = renderHook(() =>
      useErrorHandler({
        redirectPath: "/login",
      })
    );

    expect(result.current.canRedirect).toBe(true);

    act(() => {
      result.current.triggerRedirect();
    });

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  test("handles missing retry function", () => {
    const { result } = renderHook(() =>
      useErrorHandler({
        redirectPath: "/login",
      })
    );

    expect(result.current.canRetry).toBe(false);

    // Should not throw error when triggering retry without onRetry
    act(() => {
      result.current.triggerRetry();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("handles missing redirect path", () => {
    const mockRetry = jest.fn();
    const { result } = renderHook(() =>
      useErrorHandler({
        onRetry: mockRetry,
      })
    );

    expect(result.current.canRedirect).toBe(false);

    // Should not throw error when triggering redirect without path
    act(() => {
      result.current.triggerRedirect();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("handles both retry and redirect actions", () => {
    const mockRetry = jest.fn();
    const { result } = renderHook(() =>
      useErrorHandler({
        onRetry: mockRetry,
        redirectPath: "/signup",
      })
    );

    expect(result.current.canRetry).toBe(true);
    expect(result.current.canRedirect).toBe(true);

    act(() => {
      result.current.triggerRetry();
    });
    expect(mockRetry).toHaveBeenCalled();

    act(() => {
      result.current.triggerRedirect();
    });
    expect(mockPush).toHaveBeenCalledWith("/signup");
  });

  test("handles empty options", () => {
    const { result } = renderHook(() => useErrorHandler({}));

    expect(result.current.canRetry).toBe(false);
    expect(result.current.canRedirect).toBe(false);

    // Should not throw errors when triggering without handlers
    act(() => {
      result.current.triggerRetry();
      result.current.triggerRedirect();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
