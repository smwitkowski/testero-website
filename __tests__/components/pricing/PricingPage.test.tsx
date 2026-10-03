import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PricingPage from "@/app/pricing/page";
import { useAuth } from "@/components/providers/AuthProvider";
import { mockRouter } from "@/__tests__/test-utils/mockNextNavigation";

jest.mock("@/components/providers/AuthProvider", () => ({ useAuth: jest.fn() }));
const mockCapture = jest.fn();
jest.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: mockCapture }) }));
jest.mock("@/lib/analytics/analytics", () => ({
  ANALYTICS_EVENTS: { PRICING_PAGE_VIEWED: "pricing_page_viewed", CHECKOUT_INITIATED: "checkout_initiated", SIGNUP_ATTEMPT: "signup_attempt", CHECKOUT_SESSION_CREATED: "checkout_session_created", CHECKOUT_ERROR: "checkout_error" },
  trackEvent: (_posthog: unknown, event: string, properties: unknown) => mockCapture(event, properties),
}));
const mockFetch = jest.fn();

describe("PricingPage checkout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-test" } });
    global.fetch = mockFetch;
    Object.defineProperty(global.crypto, "randomUUID", { configurable: true, value: jest.fn(() => "00000000-0000-4000-8000-000000000000") });
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Mock failure" }) });
  });

  it("presents only PMLE Pass with no renewal and refund-revocation copy", () => {
    render(<PricingPage />);
    expect(screen.getByRole("button", { name: "Get PMLE Pass" })).toBeInTheDocument();
    expect(screen.getByText("7-day refund window. A refund ends your pass access.")).toBeInTheDocument();
    expect(screen.queryByText(/cancel anytime|\/month|all-access|trial/i)).not.toBeInTheDocument();
  });

  it("sends only an idempotency key, not a client-selected Stripe price", async () => {
    render(<PricingPage />);
    await userEvent.click(screen.getByRole("button", { name: "Get PMLE Pass" }));
    expect(mockFetch).toHaveBeenCalledWith("/api/billing/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: "00000000-0000-4000-8000-000000000000" }),
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to start PMLE Pass checkout");
    expect(mockCapture).toHaveBeenCalledWith("checkout_initiated", expect.objectContaining({ plan_name: "PMLE Pass", payment_mode: "payment" }));
  });

  it("redirects anonymous buyers to signup without any checkout call", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    render(<PricingPage />);
    await userEvent.click(screen.getByRole("button", { name: "Get PMLE Pass" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/signup?redirect=/pricing");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("keeps its idempotency key across failed retries", async () => {
    render(<PricingPage />);
    await userEvent.click(screen.getByRole("button", { name: "Get PMLE Pass" }));
    await userEvent.click(screen.getByRole("button", { name: "Get PMLE Pass" }));
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][1].body).toEqual(mockFetch.mock.calls[1][1].body);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate taps while checkout is in flight", async () => {
    let finish!: (value: unknown) => void;
    mockFetch.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<PricingPage />);
    const button = screen.getByRole("button", { name: "Get PMLE Pass" });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: false, json: async () => ({ error: "Mock failure" }) }));
  });

  it("treats a missing checkout URL as failure, not success", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<PricingPage />);
    await userEvent.click(screen.getByRole("button", { name: "Get PMLE Pass" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to start PMLE Pass checkout");
    expect(mockCapture).not.toHaveBeenCalledWith("checkout_session_created", expect.anything());
  });
});
