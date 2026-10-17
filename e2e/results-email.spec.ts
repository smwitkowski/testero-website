import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { DiagnosticProgress } from "../lib/diagnostic/types";

// Browser submission transport is mocked. Persistence is covered separately by results-email-db.mjs.
test("completed diagnostic offers optional results email with consent (mocked submission transport)", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  expect(url.port).toBe("56541");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await page.request.post("/api/diagnostic", { data: {} });
  expect(created.status()).toBe(201);
  const { sessionId } = await created.json() as { sessionId: string };
  const api = `/api/diagnostic/${sessionId}`;
  const foreign = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  try {
    const incomplete = await page.request.post(`${api}/email`, { data: { email: "results@example.test", consent: true } });
    expect(incomplete.status()).toBe(409);
    // Complete a real local diagnostic through its owner-authenticated answer API.
    for (;;) {
      const response = await page.request.get(api);
      expect(response.status()).toBe(200);
      const progress = await response.json() as DiagnosticProgress;
      if (progress.status === "completed") break;
      const question = progress.currentQuestion!;
      expect((await page.request.post(`${api}/answer`, { data: { itemId: question.id, selectedLabel: question.options[0].label } })).status()).toBe(200);
    }
    await page.goto(`/diagnostic/${sessionId}/results`);
    await expect(page.getByRole("heading", { name: "PMLE readiness report", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Score by domain", exact: true })).toBeVisible();
    const section = page.getByRole("region", { name: "Email me my results + a 4-week plan", exact: true });
    await expect(section).toContainText("Optional: one email with your results; no newsletter.");
    const consent = section.getByRole("checkbox");
    await expect(consent).not.toBeChecked();
    await expect(page.getByRole("link", { name: "Retake the diagnostic", exact: true })).toBeVisible();
    const payloads: unknown[] = [];
    await page.route(`**${api}/email`, async route => {
      expect(route.request().method()).toBe("POST");
      payloads.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Your results email has been sent." }) });
    });
    await section.getByLabel("Email address").fill("results@example.test");
    await section.getByRole("button", { name: "Email my results", exact: true }).click();
    expect(payloads).toHaveLength(0); // Native required consent blocks submission, never the results.
    await consent.check();
    await section.getByRole("button", { name: "Email my results", exact: true }).click();
    await expect(section.getByRole("status")).toHaveText("Your results email has been sent.");
    expect(payloads).toEqual([{ email: "results@example.test", consent: true, website: "" }]);
    await expect(section.getByRole("button", { name: "Email my results", exact: true })).toHaveCount(0);
    // APIRequestContext is not intercepted by page.route: these are real ownership checks.
    const denied = await foreign.request.post(`${api}/email`, { data: { email: "results@example.test", consent: true } });
    expect(denied.status()).toBe(404);
    expect((await foreign.request.get(`${api}/results`)).status()).toBe(404);
    const stored = await service.from("results_email_requests").select("id").eq("session_id", sessionId);
    expect(stored.error).toBeNull(); expect(stored.data).toEqual([]);
  } finally {
    await foreign.close();
    const cleanup = await service.from("study_sessions").delete().eq("id", sessionId);
    expect(cleanup.error).toBeNull();
  }
});
