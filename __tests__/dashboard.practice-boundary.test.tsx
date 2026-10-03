import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Dashboard from "@/app/dashboard/page";
const mockPush = jest.fn();
const mockUser = { id: "free" };
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/components/providers/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("posthog-js/react", () => ({ usePostHog: () => null }));
jest.mock("@/components/dashboard/DashboardHeader", () => ({ DashboardHeader: () => null }));
jest.mock("@/components/dashboard/ReadinessSnapshotCard", () => ({ ReadinessSnapshotCard: () => null }));
jest.mock("@/components/dashboard/ExamBlueprintTable", () => ({ ExamBlueprintTable: () => null }));
jest.mock("@/components/dashboard/RecentActivityList", () => ({ RecentActivityList: () => null }));
jest.mock("@/components/dashboard/NextBestStepCard", () => ({
  NextBestStepCard: ({ onDomainCardClick }: { onDomainCardClick: () => Promise<void> }) => <button onClick={onDomainCardClick}>Start targeted practice</button>,
}));
beforeEach(() => { jest.clearAllMocks(); });
it.each([403, 500, "network"])("shows the pass path on refused creation (%s), never standalone fallback", async (failure) => {
  global.fetch = jest.fn((url) => {
    if (url === "/api/practice/session") {
      if (failure === "network") return Promise.reject(new Error("offline"));
      return Promise.resolve({ ok: false, status: failure, json: async () => ({ code: "FREE_QUOTA_EXCEEDED" }) });
    }
    return Promise.resolve({ ok: true, json: async () => url === "/api/dashboard"
      ? { data: { practice: { accuracyPercentage: 0, totalQuestionsAnswered: 0, correctAnswers: 0 }, diagnostic: { totalSessions: 1 } } }
      : url === "/api/billing/status" ? { isSubscriber: false } : { status: "ok", data: {} } });
  }) as jest.Mock;
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole("button", { name: "Start targeted practice" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/pricing?gated=1&feature=practice"));
  expect(mockPush.mock.calls.some(([url]) => url.includes("/practice/question"))).toBe(false);
  expect(global.fetch).toHaveBeenCalledWith("/api/practice/session", expect.objectContaining({ method: "POST" }));
  spy.mockRestore();
});
