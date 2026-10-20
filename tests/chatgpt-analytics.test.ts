import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleChatgptEvent } from "@/lib/chatgpt/analytics";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

const afterMock = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after: afterMock }));
const fetchMock = vi.fn();
const domain = PMLE_BLUEPRINT[0].domainCode;
const request = (headers: Record<string, string> = {}) => new Request("https://testero.ai/api/mcp", { headers });

beforeEach(() => {
  afterMock.mockReset();
  fetchMock.mockReset().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "unit-placeholder-not-a-real-key");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "http://127.0.0.1:56546/");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function runScheduled(index = 0) { await afterMock.mock.calls[index][0](); }
function payload(index = 0) { return JSON.parse(fetchMock.mock.calls[index][1].body); }

describe("ChatGPT event-only analytics", () => {
  it("defers capture until after the tool response and sends only aggregate metadata", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    scheduleChatgptEvent(request(), "chatgpt_question_served", domain);
    expect(afterMock).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    await runScheduled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:56546/i/v0/e/");
    expect(init).toEqual(expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: expect.any(AbortSignal) }));
    expect(timeout).toHaveBeenCalledWith(1000);
    expect(payload()).toEqual({ api_key: "unit-placeholder-not-a-real-key", event: "chatgpt_question_served", properties: {
      distinct_id: expect.stringMatching(/^chatgpt_event_[0-9a-f-]{36}$/), source: "server", $process_person_profile: false, $geoip_disable: true, domain,
    } });
  });

  it.each([true, false])("records answer correctness %s, with no answer or question content", async isCorrect => {
    scheduleChatgptEvent(request(), "chatgpt_answer_checked", domain, isCorrect);
    await runScheduled();
    expect(payload()).toEqual({ api_key: "unit-placeholder-not-a-real-key", event: "chatgpt_answer_checked", properties: {
      distinct_id: expect.stringMatching(/^chatgpt_event_[0-9a-f-]{36}$/), source: "server", $process_person_profile: false, $geoip_disable: true, domain, is_correct: isCorrect,
    } });
  });

  it("never attaches correctness to question-served events", async () => {
    scheduleChatgptEvent(request(), "chatgpt_question_served", domain, true);
    await runScheduled();
    expect(payload().properties).not.toHaveProperty("is_correct");
  });

  it("ignores all caller identity and generates a separate identity for every event", async () => {
    const privateRequest = request({
      "X-PostHog-Distinct-Id": "supplied_person_identifier", "x-forwarded-for": "203.0.113.77",
      cookie: "session=secret-session; email=private@example.com", authorization: "Bearer secret-token",
      "user-agent": "Personal device identifier",
    });
    scheduleChatgptEvent(privateRequest, "chatgpt_question_served", domain);
    scheduleChatgptEvent(privateRequest, "chatgpt_answer_checked", domain, false);
    await runScheduled(0); await runScheduled(1);
    expect(payload(0).properties.distinct_id).not.toBe(payload(1).properties.distinct_id);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.body).not.toMatch(/supplied_person_identifier|203\.0\.113\.77|secret-session|private@example\.com|secret-token|Personal device/);
      expect(init.body).not.toMatch(/question_id|selected_label|stem|explanation|\$ip|user_agent|session_id/);
      expect(new Headers(init.headers).get("X-PostHog-Distinct-Id")).toBeNull();
    }
  });

  it.each<Record<string, string>>([
    { cookie: "testero_internal=1" },
    { cookie: "other=value; testero_internal=1; last=yes" },
    { "user-agent": "Mozilla/5.0 HeadlessChrome/131.0" },
    { "user-agent": "Playwright" },
    { "user-agent": "Googlebot/2.1" },
    { "user-agent": "crawler" },
    { "user-agent": "spider" },
  ])("skips internal and bot traffic: %j", async headers => {
    for (const event of ["chatgpt_question_served", "chatgpt_answer_checked"] as const) {
      scheduleChatgptEvent(request(headers), event, domain, true);
    }
    expect(afterMock).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts real learners with the internal cookie set to zero", async () => {
    scheduleChatgptEvent(request({ cookie: "testero_internal=0", "user-agent": "Mozilla/5.0 Safari/604.1" }), "chatgpt_question_served", domain);
    expect(afterMock).toHaveBeenCalledOnce();
  });

  it("does nothing when the optional analytics key is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    scheduleChatgptEvent(request(), "chatgpt_question_served", domain);
    expect(afterMock).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["private@example.com", "D99", "", "<script>secret</script>"])("rejects unknown domain metadata %j", invalidDomain => {
    scheduleChatgptEvent(request(), "chatgpt_question_served", invalidDomain);
    expect(afterMock).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the default ingestion host when no host is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "");
    scheduleChatgptEvent(request(), "chatgpt_question_served", domain);
    await runScheduled();
    expect(fetchMock.mock.calls[0][0]).toBe("https://us.i.posthog.com/i/v0/e/");
  });

  it("isolates a missing request lifecycle from the tool response", () => {
    afterMock.mockImplementation(() => { throw new Error("No after context"); });
    expect(() => scheduleChatgptEvent(request(), "chatgpt_question_served", domain)).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([new Error("network unavailable"), new DOMException("timeout", "TimeoutError")])("isolates analytics transport failure: %s", async error => {
    fetchMock.mockRejectedValue(error);
    scheduleChatgptEvent(request(), "chatgpt_answer_checked", domain, true);
    await expect(runScheduled()).resolves.toBeUndefined();
  });
});
