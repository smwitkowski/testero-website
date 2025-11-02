/** @jest-environment node */

import React from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isBillingEnforcementActive } from "@/lib/billing/enforcement";
import { isSubscriber } from "@/lib/billing/is-subscriber";

// Mock dependencies
jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/billing/enforcement", () => ({
  isBillingEnforcementActive: jest.fn(),
}));

jest.mock("@/lib/billing/is-subscriber", () => ({
  isSubscriber: jest.fn(),
}));

describe("Diagnostic Layout Gating", () => {
  let mockSupabase: any;
  let mockLayout: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    (redirect as jest.Mock).mockImplementation(() => {
      throw new Error("REDIRECT"); // Next.js redirect throws
    });

    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
    };

    (createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    // Dynamically import layout to get fresh module
    delete require.cache[require.resolve("@/app/diagnostic/layout")];
    mockLayout = (await import("@/app/diagnostic/layout")).default;
  });

  it("should not redirect when enforcement is off", async () => {
    (isBillingEnforcementActive as jest.Mock).mockReturnValue(false);

    const children = React.createElement("div", null, "Test Content");
    const result = await mockLayout({ children });

    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBe(children);
  });

  it("should redirect to pricing when enforcement is on and user is not authenticated", async () => {
    (isBillingEnforcementActive as jest.Mock).mockReturnValue(true);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const children = React.createElement("div", null, "Test Content");

    await expect(mockLayout({ children })).rejects.toThrow("REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/pricing?gated=1&feature=diagnostic");
  });

  it("should redirect when enforcement is on and user is not a subscriber", async () => {
    (isBillingEnforcementActive as jest.Mock).mockReturnValue(true);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    (isSubscriber as jest.Mock).mockResolvedValue(false);

    const children = React.createElement("div", null, "Test Content");

    await expect(mockLayout({ children })).rejects.toThrow("REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/pricing?gated=1&feature=diagnostic");
    expect(isSubscriber).toHaveBeenCalledWith("user-123");
  });

  it("should allow access when enforcement is on and user has active subscription", async () => {
    (isBillingEnforcementActive as jest.Mock).mockReturnValue(true);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    (isSubscriber as jest.Mock).mockResolvedValue(true);

    const children = React.createElement("div", null, "Test Content");
    const result = await mockLayout({ children });

    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBe(children);
    expect(isSubscriber).toHaveBeenCalledWith("user-123");
  });

  it("should allow access when enforcement is on and user has valid trialing subscription", async () => {
    (isBillingEnforcementActive as jest.Mock).mockReturnValue(true);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    (isSubscriber as jest.Mock).mockResolvedValue(true); // trialing with future date

    const children = React.createElement("div", null, "Test Content");
    const result = await mockLayout({ children });

    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBe(children);
  });

  it("should handle auth.getUser errors gracefully", async () => {
    (isBillingEnforcementActive as jest.Mock).mockReturnValue(true);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth error" },
    });

    const children = React.createElement("div", null, "Test Content");

    // Should redirect when auth fails (treated as no user)
    await expect(mockLayout({ children })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/pricing?gated=1&feature=diagnostic");
  });

  it("should handle isSubscriber errors gracefully", async () => {
    (isBillingEnforcementActive as jest.Mock).mockReturnValue(true);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    (isSubscriber as jest.Mock).mockRejectedValue(new Error("Database error"));

    const children = React.createElement("div", null, "Test Content");

    // Should redirect when subscription check fails (treated as not subscriber)
    await expect(mockLayout({ children })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/pricing?gated=1&feature=diagnostic");
  });
});

