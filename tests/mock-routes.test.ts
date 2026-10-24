import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVerifiedUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createMock, readMock, answerMock, submitMock, mockResults } from "@/lib/mock/service";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { POST as start } from "@/app/api/mock/start/route";
import { GET as read } from "@/app/api/mock/[id]/route";
import { POST as answer } from "@/app/api/mock/[id]/answer/route";
import { POST as submit } from "@/app/api/mock/[id]/submit/route";
import { GET as results } from "@/app/api/mock/[id]/results/route";
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn() }));
vi.mock("@/lib/mock/service", () => ({ createMock: vi.fn(), readMock: vi.fn(), answerMock: vi.fn(), submitMock: vi.fn(), mockResults: vi.fn() }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const itemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const context = { params: Promise.resolve({ id }) };
function request(path: string, method = "GET", body?: unknown, origin = "https://testero.test") { return new Request(`https://testero.test/api/mock/${path}`, { method, headers: { Origin: origin, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
beforeEach(() => {
  vi.mocked(getVerifiedUser).mockReset().mockResolvedValue({ id: user } as Awaited<ReturnType<typeof getVerifiedUser>>);
  vi.mocked(createServiceSupabaseClient).mockReturnValue({} as ReturnType<typeof createServiceSupabaseClient>);
  vi.mocked(createMock).mockReset().mockResolvedValue(id);
  vi.mocked(readMock).mockReset().mockResolvedValue({ status: "in_progress" } as Awaited<ReturnType<typeof readMock>>);
  vi.mocked(answerMock).mockReset().mockResolvedValue({ status: "in_progress" } as Awaited<ReturnType<typeof answerMock>>);
  vi.mocked(submitMock).mockReset().mockResolvedValue({ status: "completed" } as Awaited<ReturnType<typeof submitMock>>);
  vi.mocked(mockResults).mockReset().mockResolvedValue({ score: 50 } as Awaited<ReturnType<typeof mockResults>>);
});
describe("mock HTTP boundary", () => {
  it.each(["start", "read", "answer", "submit", "results"])("requires a verified account on %s", async operation => {
    vi.mocked(getVerifiedUser).mockResolvedValue(null);
    const response = operation === "start" ? await start(request("start", "POST")) : operation === "read" ? await read(request(id), context) : operation === "answer" ? await answer(request(`${id}/answer`, "POST", { itemId, selectedLabel: "A" }), context) : operation === "submit" ? await submit(request(`${id}/submit`, "POST"), context) : await results(request(`${id}/results`), context);
    expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(createServiceSupabaseClient).not.toHaveBeenCalled();
  });
  it.each(["start", "answer", "submit"])("rejects cross-origin mutation on %s", async operation => {
    const response = operation === "start" ? await start(request("start", "POST", undefined, "https://evil.test")) : operation === "answer" ? await answer(request(`${id}/answer`, "POST", { itemId, selectedLabel: "A" }, "https://evil.test"), context) : await submit(request(`${id}/submit`, "POST", undefined, "https://evil.test"), context);
    expect(response.status).toBe(403); expect(createMock).not.toHaveBeenCalled(); expect(answerMock).not.toHaveBeenCalled(); expect(submitMock).not.toHaveBeenCalled();
  });
  it("starts without accepting a user-supplied deadline or owner", async () => {
    const response = await start(request("start", "POST", { userId: "foreign", deadlineAt: "2099-01-01" }));
    expect(response.status).toBe(201); expect(await response.json()).toEqual({ sessionId: id, href: `/mock/${id}` });
    expect(createMock).toHaveBeenCalledWith({}, user);
  });
  it.each([{ itemId, selectedLabel: "A", correctLabel: "A" }, { itemId: "bad", selectedLabel: "A" }, { itemId, selectedLabel: "answer A" }])("rejects malformed/extra answer fields %#", async body => {
    const response = await answer(request(`${id}/answer`, "POST", body), context); expect(response.status).toBe(400); expect(answerMock).not.toHaveBeenCalled();
  });
  it("passes only server-verified ownership and validated selected choice", async () => {
    const response = await answer(request(`${id}/answer`, "POST", { itemId, selectedLabel: "B" }), context);
    expect(response.status).toBe(200); expect(answerMock).toHaveBeenCalledWith({}, id, user, itemId, "B"); expect(await response.json()).toEqual({ status: "in_progress" });
  });
  it("returns no-store on results and maps Pass denial to a real locked entry", async () => {
    vi.mocked(mockResults).mockRejectedValue(new DiagnosticError(403, "PMLE Pass required"));
    const response = await results(request(`${id}/results`), context); expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(await response.json()).toEqual({ error: "PMLE Pass required", upgradeHref: "/pricing" });
  });
});
