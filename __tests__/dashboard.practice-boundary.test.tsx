import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Dashboard from "@/app/dashboard/page";
const mockPush = jest.fn();
let mockUser = { id: "free" };
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/components/providers/AuthProvider", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("posthog-js/react", () => ({ usePostHog: () => null }));
jest.mock("@/components/dashboard/DashboardHeader", () => ({ DashboardHeader: () => null }));
jest.mock("@/components/dashboard/ReadinessSnapshotCard", () => ({ ReadinessSnapshotCard: () => null }));
jest.mock("@/components/dashboard/ExamBlueprintTable", () => ({ ExamBlueprintTable: () => null }));
jest.mock("@/components/dashboard/RecentActivityList", () => ({ RecentActivityList: () => null }));
jest.mock("@/components/dashboard/NextBestStepCard", () => ({
  NextBestStepCard: ({ onDomainCardClick, questionCount }: { onDomainCardClick: () => Promise<void>; questionCount: number }) => <button onClick={onDomainCardClick}>Start targeted practice ({questionCount})</button>,
}));
beforeEach(() => { jest.clearAllMocks(); mockUser = { id: "free" }; });
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
  fireEvent.click(await screen.findByRole("button", { name: "Start targeted practice (5)" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/pricing?gated=1&feature=practice"));
  expect(mockPush.mock.calls.some(([url]) => url.includes("/practice/question"))).toBe(false);
  expect(global.fetch).toHaveBeenCalledWith("/api/practice/session", expect.objectContaining({ method: "POST" }));
  const practiceCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === "/api/practice/session");
  expect(JSON.parse(practiceCall[1].body).questionCount).toBe(5);
  spy.mockRestore();
});

it("does not reuse a late paid account response for a new free account", async () => {
  let resolvePaid!: (value: unknown) => void;
  const paidBilling = new Promise((resolve) => { resolvePaid = resolve; });
  const dataResponse = { ok: true, json: async () => ({ data: {
    practice: { accuracyPercentage: 0, totalQuestionsAnswered: 0, correctAnswers: 0 }, diagnostic: { totalSessions: 1 },
  } }) };
  mockUser = { id: "paid-a" };
  global.fetch = jest.fn((url) => url === "/api/billing/status" ? paidBilling
    : Promise.resolve(url === "/api/dashboard" ? dataResponse : { ok: true, json: async () => ({ status: "ok", data: {} }) })) as jest.Mock;
  const view = render(<Dashboard />);
  mockUser = { id: "free-b" };
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn((url) => url === "/api/billing/status" ? Promise.reject(new Error("status offline"))
    : Promise.resolve(url === "/api/dashboard" ? dataResponse : url === "/api/practice/session"
      ? { ok: false, status: 403, json: async () => ({ code: "FREE_QUOTA_EXCEEDED" }) }
      : { ok: true, json: async () => ({ status: "ok", data: {} }) })) as jest.Mock;
  view.rerender(<Dashboard />);
  await screen.findByRole("button", { name: "Start targeted practice (5)" });
  await act(async () => { resolvePaid({ ok: true, json: async () => ({ isSubscriber: true }) }); });
  expect(screen.queryByRole("button", { name: "Start targeted practice (10)" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start targeted practice (5)" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/pricing?gated=1&feature=practice"));
  const practiceCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === "/api/practice/session");
  expect(JSON.parse(practiceCall[1].body).questionCount).toBe(5);
  spy.mockRestore();
});

it.each([[false, 5], [true, 10]] as const)("requests the displayed practice size for paid=%s", async (paid, count) => {
  global.fetch = jest.fn((url) => Promise.resolve({ ok: true, status: 200, json: async () => {
    if (url === "/api/billing/status") return { isSubscriber: paid };
    if (url === "/api/dashboard") return { data: {
      practice: { accuracyPercentage: 0, totalQuestionsAnswered: 0, correctAnswers: 0 }, diagnostic: { totalSessions: 1 },
    } };
    if (url === "/api/practice/session") return { sessionId: "created", route: "/practice/session/created" };
    return { status: "ok", data: {} };
  } })) as jest.Mock;
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole("button", { name: `Start targeted practice (${count})` }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/practice/session/created"));
  const practiceCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === "/api/practice/session");
  expect(JSON.parse(practiceCall[1].body).questionCount).toBe(count);
});
