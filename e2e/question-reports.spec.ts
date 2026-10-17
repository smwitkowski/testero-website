import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { DiagnosticProgress } from "../lib/diagnostic/types";

test("question reporting saves a diagnostic typo and rejects foreign ownership and membership", async ({ page, browser }) => {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid");
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(url.hostname);
  expect(url.protocol).toBe("http:"); expect(url.port).toBe("56541");
  expect(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").toBe("");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const sessions: string[] = [];
  const foreign = await browser.newContext();
  try {
    const created = await page.request.post("/api/diagnostic", { data: {} });
    expect(created.status()).toBe(201);
    const { sessionId } = await created.json() as { sessionId: string }; sessions.push(sessionId);
    const progress = await (await page.request.get(`/api/diagnostic/${sessionId}`)).json() as DiagnosticProgress;
    const itemId = progress.currentQuestion!.id;
    await page.goto(`/diagnostic/${sessionId}`);
    await page.getByRole("button", { name: "Report a problem with this question" }).click();
    await page.getByLabel("Reason", { exact: true }).selectOption("typo");
    await page.getByLabel("Note (optional)").fill("Local reporting browser verifier");
    const saved = page.waitForResponse(response => response.url().endsWith("/api/question-reports") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Send report", exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText("Thanks, we review every report.", { exact: true })).toBeVisible();
    const { data: reports, error } = await service.from("question_reports").select("item_id,question_id,reason,note,email").eq("session_id", sessionId);
    expect(error).toBeNull(); expect(reports).toHaveLength(1);
    const { data: item } = await service.from("session_items").select("question_id").eq("id", itemId).single();
    expect(reports![0]).toEqual({ item_id: itemId, question_id: item!.question_id, reason: "typo", note: "Local reporting browser verifier", email: "" });
    const body = { sessionId, itemId, kind: "diagnostic", reason: "typo" };
    const foreignWrite = await foreign.request.post("http://127.0.0.1:3000/api/question-reports", { data: body });
    expect(foreignWrite.status()).toBe(404);
    // A second session belongs to this browser but its item is not a member of the first.
    const another = await page.request.post("/api/diagnostic", { data: {} }); expect(another.status()).toBe(201);
    const { sessionId: otherId } = await another.json() as { sessionId: string }; sessions.push(otherId);
    const other = await (await page.request.get(`/api/diagnostic/${otherId}`)).json() as DiagnosticProgress;
    const wrongItem = await page.request.post("/api/question-reports", { data: { ...body, itemId: other.currentQuestion!.id } });
    expect(wrongItem.status()).toBe(404);
    const { count, error: countError } = await service.from("question_reports").select("id", { count: "exact", head: true }).in("session_id", sessions);
    expect(countError).toBeNull(); expect(count).toBe(1);
  } finally {
    await foreign.close();
    if (sessions.length) {
      const deleted = await service.from("question_reports").delete().in("session_id", sessions); expect(deleted.error).toBeNull();
      const removed = await service.from("study_sessions").delete().in("id", sessions); expect(removed.error).toBeNull();
    }
  }
});
