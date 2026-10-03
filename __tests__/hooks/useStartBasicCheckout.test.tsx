import { act, renderHook } from "@testing-library/react";
import { useStartBasicCheckout } from "@/hooks/useStartBasicCheckout";
import { useAuth } from "@/components/providers/AuthProvider";
import { mockRouter } from "@/__tests__/test-utils/mockNextNavigation";

jest.mock("@/components/providers/AuthProvider", () => ({ useAuth: jest.fn() }));
const mockCapture = jest.fn();
jest.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: mockCapture }) }));
const mockFetch = jest.fn();

describe("useStartBasicCheckout — PMLE Pass compatibility hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-test" } });
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Mock failure" }) });
    Object.defineProperty(global.crypto, "randomUUID", { configurable: true, value: jest.fn(() => "00000000-0000-4000-8000-000000000000") });
  });

  it("routes anonymous users to signup without public price configuration", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    const { result } = renderHook(() => useStartBasicCheckout());
    await act(async () => result.current.startBasicCheckout("test"));
    expect(mockRouter.push).toHaveBeenCalledWith("/signup?redirect=/pricing");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends only an idempotency key and exact PMLE Pass analytics", async () => {
    const { result } = renderHook(() => useStartBasicCheckout());
    await act(async () => result.current.startBasicCheckout("test"));
    expect(mockFetch).toHaveBeenCalledWith("/api/billing/checkout", expect.objectContaining({ body: JSON.stringify({ idempotencyKey: "00000000-0000-4000-8000-000000000000" }) }));
    expect(mockCapture).toHaveBeenCalledWith("checkout_initiated", expect.objectContaining({ plan_name: "PMLE Pass", payment_mode: "payment", plan_type: "pass" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/pricing?checkout=error");
  });

  it("reuses the key after a failed checkout", async () => {
    const { result } = renderHook(() => useStartBasicCheckout());
    await act(async () => result.current.startBasicCheckout("test"));
    await act(async () => result.current.startBasicCheckout("test"));
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][1].body).toEqual(mockFetch.mock.calls[1][1].body);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate submissions before the first response", async () => {
    let finish!: (value: unknown) => void;
    mockFetch.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useStartBasicCheckout());
    let pending!: Promise<void>;
    act(() => { pending = result.current.startBasicCheckout("test"); });
    await act(async () => result.current.startBasicCheckout("test"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, json: async () => ({ error: "Mock failure" }) }); await pending; });
  });

  it("recovers if key generation fails instead of leaving checkout locked", async () => {
    (crypto.randomUUID as jest.Mock).mockImplementationOnce(() => { throw new Error("Mock crypto unavailable"); });
    const { result } = renderHook(() => useStartBasicCheckout());
    await act(async () => result.current.startBasicCheckout("test"));
    await act(async () => result.current.startBasicCheckout("test"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
