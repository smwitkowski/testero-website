import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/diagnostic/[sessionId]/free-explanation/route";
import { diagnosticFreeExplanation } from "@/lib/diagnostic/service";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { DiagnosticError } from "@/lib/diagnostic/http";
vi.mock("@/lib/diagnostic/service", () => ({ diagnosticFreeExplanation: vi.fn() }));
vi.mock("@/lib/diagnostic/request", () => ({ diagnosticCredentials: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => "service-client" }));
const context = { params: Promise.resolve({ sessionId: "session" }) };
beforeEach(() => {
  vi.mocked(diagnosticCredentials).mockResolvedValue({ userId: null, anonymousToken: "cookie-token" });
  vi.mocked(diagnosticFreeExplanation).mockReset().mockResolvedValue({ itemId: "selected-item" } as never);
});
it("uses only server credentials and returns one no-store explanation", async () => {
  const response = await GET(new Request("https://testero.ai/api/diagnostic/session/free-explanation"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ itemId: "selected-item" });
  expect(diagnosticFreeExplanation).toHaveBeenCalledWith("service-client", "session", { userId: null, anonymousToken: "cookie-token" });
});
it("does not accept item selectors in query parameters", async () => {
  const response = await GET(new Request("https://testero.ai/api/diagnostic/session/free-explanation?itemId=other"), context);
  expect(response.status).toBe(400);
  expect(diagnosticFreeExplanation).not.toHaveBeenCalled();
});
it.each([404, 409, 503])("preserves safe error %s and no-store", async status => {
  vi.mocked(diagnosticFreeExplanation).mockRejectedValue(new DiagnosticError(status, "Safe error"));
  const response = await GET(new Request("https://testero.ai/api/diagnostic/session/free-explanation"), context);
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: "Safe error" });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
