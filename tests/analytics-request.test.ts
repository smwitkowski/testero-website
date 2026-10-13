import { afterEach, expect, it, vi } from "vitest";
import { diagnosticRequest } from "@/components/diagnostic-resource";
vi.mock("@/lib/analytics/client", () => ({ analyticsHeaders: () => ({ "X-PostHog-Distinct-Id": "anonymous-id" }) }));
afterEach(() => vi.unstubAllGlobals());
it("attaches diagnostic analytics identity only to POSTs without changing the answer body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  const body = JSON.stringify({ itemId: "item", selectedLabel: "A" });
  await diagnosticRequest("/api/diagnostic/session/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const options = vi.mocked(fetch).mock.calls[0][1]!;
  expect(new Headers(options.headers).get("X-PostHog-Distinct-Id")).toBe("anonymous-id");
  expect(new Headers(options.headers).get("Content-Type")).toBe("application/json");
  expect(options.body).toBe(body);
  vi.mocked(fetch).mockResolvedValue(new Response("{}"));
  await diagnosticRequest("/api/diagnostic/session");
  expect(new Headers(vi.mocked(fetch).mock.calls[1][1]!.headers).has("X-PostHog-Distinct-Id")).toBe(false);
});
