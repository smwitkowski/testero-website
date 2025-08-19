/** @jest-environment jsdom */

import { renderHook, act } from "@testing-library/react";
import { useRedirect } from "@/components/auth/hooks/useRedirect";

// Mock useRouter
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("useRedirect", () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test("returns initial countdown value", () => {
    const { result } = renderHook(() =>
      useRedirect({
        redirectPath: "/dashboard",
        autoRedirect: true,
        redirectDelay: 5000,
      })
    );

    expect(result.current.countdown).toBe(5);
    expect(result.current.isAutoRedirecting).toBe(true);
  });

  test("triggers manual redirect", () => {
    const { result } = renderHook(() =>
      useRedirect({
        redirectPath: "/dashboard",
        autoRedirect: false,
      })
    );

    act(() => {
      result.current.triggerRedirect();
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  test("handles auto-redirect with countdown", () => {
    const { result } = renderHook(() =>
      useRedirect({
        redirectPath: "/dashboard",
        autoRedirect: true,
        redirectDelay: 3000,
      })
    );

    expect(result.current.countdown).toBe(3);
    expect(result.current.isAutoRedirecting).toBe(true);

    // Fast-forward 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.countdown).toBe(2);

    // Fast-forward to redirect time
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  test("disables auto-redirect when autoRedirect is false", () => {
    const { result } = renderHook(() =>
      useRedirect({
        redirectPath: "/dashboard",
        autoRedirect: false,
        redirectDelay: 1000,
      })
    );

    expect(result.current.isAutoRedirecting).toBe(false);

    // Fast-forward past redirect time
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("cleans up timer on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useRedirect({
        redirectPath: "/dashboard",
        autoRedirect: true,
        redirectDelay: 5000,
      })
    );

    expect(result.current.isAutoRedirecting).toBe(true);

    unmount();

    // Fast-forward past redirect time
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("handles missing redirectPath gracefully", () => {
    const { result } = renderHook(() =>
      useRedirect({
        autoRedirect: true,
        redirectDelay: 1000,
      })
    );

    expect(result.current.isAutoRedirecting).toBe(false);

    act(() => {
      result.current.triggerRedirect();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("uses default redirectDelay", () => {
    const { result } = renderHook(() =>
      useRedirect({
        redirectPath: "/dashboard",
        autoRedirect: true,
      })
    );

    // Default is 3000ms = 3 seconds
    expect(result.current.countdown).toBe(3);
  });
});
