import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BillingDashboard from "@/app/dashboard/billing/page";
import { useAuth } from "@/components/providers/AuthProvider";
import { resetMockSearchParams } from "@/__tests__/test-utils/mockNextNavigation";

jest.mock("@/components/providers/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("posthog-js/react", () => ({ usePostHog: () => null }));
const mockLimit = jest.fn();
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: mockLimit }) }) }) }) }),
}));
const mockFetch = jest.fn();
const noAccess = { isSubscriber: false, status: "none", accessType: null, accessUntil: null, canManageSubscription: false };

describe("BillingDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-test" }, isLoading: false });
    global.fetch = mockFetch;
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockFetch.mockResolvedValue({ ok: true, json: async () => noAccess });
  });

  it("shows pass expiry, one-time terms and refund revocation; hides subscription portal", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...noAccess, isSubscriber: true, accessType: "pass", accessUntil: "2027-01-01T12:00:00Z" }) });
    render(<BillingDashboard />);
    expect(await screen.findByText("PMLE Pass")).toBeInTheDocument();
    expect(screen.getByText("Access until January 1, 2027")).toBeInTheDocument();
    expect(screen.getByText("No subscription. No automatic renewal.")).toBeInTheDocument();
    expect(screen.getByText(/7-day refund window. A refund ends your pass access/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage Subscription" })).not.toBeInTheDocument();
  });

  it("preserves active legacy access and portal management", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...noAccess, isSubscriber: true, accessType: "legacy_subscription", status: "active", accessUntil: "2027-01-01T12:00:00Z", canManageSubscription: true }) });
    render(<BillingDashboard />);
    expect(await screen.findByText("Legacy subscription")).toBeInTheDocument();
    expect(screen.getByText("Your existing subscription remains active.")).toBeInTheDocument();
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "test portal error" }) });
    await userEvent.click(screen.getByRole("button", { name: "Manage Subscription" }));
    expect(mockFetch).toHaveBeenCalledWith("/api/billing/portal", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to open billing portal");
  });

  it("allows past-due legacy customers to manage billing without granting access", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...noAccess, status: "past_due", canManageSubscription: true }) });
    render(<BillingDashboard />);
    expect(await screen.findByText("You don't have active paid access.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage Subscription" })).toBeEnabled();
    expect(screen.getByText("Legacy subscription status: past due")).toBeInTheDocument();
  });

  it("offers the pass for expired or refunded access", async () => {
    render(<BillingDashboard />);
    expect(await screen.findByRole("link", { name: "Get PMLE Pass" })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByText(/Access until/)).not.toBeInTheDocument();
  });

  it("does not claim active access from a checkout redirect alone", async () => {
    resetMockSearchParams({ success: "1" });
    render(<BillingDashboard />);
    expect(await screen.findByText(/Payment received. Access appears here after payment confirmation/)).toBeInTheDocument();
    expect(await screen.findByText("You don't have active paid access.")).toBeInTheDocument();
  });

  it("shows an error if status fails instead of fabricating paid access", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    render(<BillingDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your access details");
    expect(screen.queryByText("PMLE Pass")).not.toBeInTheDocument();
  });

  it("retains existing payment history", async () => {
    mockLimit.mockResolvedValue({ data: [{ id: "payment-1", amount: 3900, status: "succeeded", created_at: "2026-10-03T12:00:00Z" }], error: null });
    render(<BillingDashboard />);
    await waitFor(() => expect(screen.getByText("Payment History")).toBeInTheDocument());
    expect(screen.getByText("$39.00")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
  });
});
