import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { DiagnosticProgress, DiagnosticAnswerResponse, DiagnosticResult } from "../lib/diagnostic/types";

function assertLocalDatabase() {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid");
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
  expect(url.port).toBe("56541");
  expect(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").toBe("");
}
function noAnswerKeys(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    expect(["correct_label", "correctLabel", "is_correct", "isCorrect", "explanation", "explanation_text", "anonymous_owner_hash", "user_id"]).not.toContain(key);
    noAnswerKeys(child);
  }
}

test("anonymous 20-question diagnostic persists snapshots and exposes aggregate results only", async ({ page, context, browser }) => {
  assertLocalDatabase();
  const failures: string[] = [];
  page.on("pageerror", error => failures.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) failures.push(`Unexpected external request: ${url.hostname}`);
  });
  await page.goto("/diagnostic");
  const createdResponse = page.waitForResponse(response => response.url().endsWith("/api/diagnostic") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Start 20-question diagnostic" }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const { sessionId } = await created.json() as { sessionId: string };
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const api = `/api/diagnostic/${sessionId}`;
    await expect(page).toHaveURL(new RegExp(`/diagnostic/${sessionId}$`));
    const cookie = (await context.cookies()).find(value => value.name === "testero_anon");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    expect(cookie?.value).toMatch(/^[a-f0-9]{64}$/);
    const firstResponse = await page.request.get(api);
    const first = await firstResponse.json() as DiagnosticProgress;
    expect(first.totalQuestions).toBe(20);
    noAnswerKeys(first);
    const earlyResults = await page.request.get(`${api}/results`);
    expect(earlyResults.status()).toBe(409);

    const foreign = await browser.newContext();
    try {
      for (const path of [api, `${api}/results`]) {
        const response = await foreign.request.get(`http://127.0.0.1:3000${path}`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ error: "Diagnostic not found" });
      }
      const foreignWrite = await foreign.request.post(`http://127.0.0.1:3000${api}/answer`, { data: { itemId: first.currentQuestion!.id, selectedLabel: "A" } });
      expect(foreignWrite.status()).toBe(404);
    } finally { await foreign.close(); }

    const seen = new Set<string>();
    for (let index = 0; index < 20; index++) {
      await expect(page.getByText(`Question ${index + 1} of 20`, { exact: true })).toBeVisible();
      const saved = await page.request.get(api);
      expect(saved.status()).toBe(200);
      const progress = await saved.json() as DiagnosticProgress;
      noAnswerKeys(progress);
      expect(progress.answeredCount).toBe(index);
      expect(progress.currentQuestion?.ordinal).toBe(index + 1);
      expect(seen.has(progress.currentQuestion!.id)).toBe(false);
      seen.add(progress.currentQuestion!.id);
      if (index === 3) {
        await page.reload();
        await expect(page.getByText("Question 4 of 20", { exact: true })).toBeVisible();
        const reloaded = await (await page.request.get(api)).json() as DiagnosticProgress;
        expect(reloaded.currentQuestion).toEqual(progress.currentQuestion);
        expect(reloaded.answeredCount).toBe(3);
      }
      await page.getByRole("radio").first().check();
      const acceptedResponse = page.waitForResponse(response => response.url().endsWith(`${api}/answer`) && response.request().method() === "POST");
      await page.getByRole("button", { name: "Submit answer" }).click();
      const accepted = await acceptedResponse;
      expect(accepted.status()).toBe(200);
      const answer = await accepted.json() as DiagnosticAnswerResponse;
      expect(answer).toEqual({ answeredCount: index + 1, totalQuestions: 20, completed: index === 19 });
      noAnswerKeys(answer);
    }
    await expect(page).toHaveURL(new RegExp(`/diagnostic/${sessionId}/results$`));
    await expect(page.getByRole("heading", { name: "Your PMLE readiness", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your domain breakdown", exact: true })).toBeVisible();
    const resultResponse = await page.request.get(`${api}/results`);
    expect(resultResponse.status()).toBe(200);
    const result = await resultResponse.json() as DiagnosticResult;
    noAnswerKeys(result);
    expect(result.totalQuestions).toBe(20);
    expect(result.domainBreakdown).toHaveLength(6);
    expect(result.domainBreakdown.reduce((sum, domain) => sum + domain.total, 0)).toBe(20);
    expect(result.domainBreakdown.reduce((sum, domain) => sum + domain.correct, 0)).toBe(result.correctAnswers);
    expect(Object.keys(result).sort()).toEqual(["sessionId", "score", "totalQuestions", "correctAnswers", "readiness", "domainBreakdown"].sort());
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Submit answer" })).toHaveCount(0);
    await expect(page.getByText(`${result.correctAnswers} of 20 correct`, { exact: true })).toBeVisible();

    const { data: rows, error } = await service.from("session_items").select("id,ordinal,is_correct,answered_at").eq("session_id", sessionId).order("ordinal");
    expect(error).toBeNull();
    expect(rows).toHaveLength(20);
    expect(rows!.every(row => !!row.answered_at)).toBe(true);
    const actualCorrect = rows!.filter(row => row.is_correct).length;
    expect(result.correctAnswers).toBe(actualCorrect);
    expect(result.score).toBe(Math.round(actualCorrect / 20 * 100));
    const completed = await (await page.request.get(api)).json() as DiagnosticProgress;
    expect(completed.currentQuestion).toBeNull();
    expect(completed.status).toBe("completed");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your PMLE readiness", exact: true })).toBeVisible();
    expect(await (await page.request.get(`${api}/results`)).json()).toEqual(result);
    const anonymous = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    for (const table of ["questions", "answers", "explanations", "session_items"]) {
      const { data, error: denied } = await anonymous.from(table).select("*").limit(1);
      expect(denied).not.toBeNull();
      expect(data).toBeNull();
    }
    expect(failures).toEqual([]);
  } finally {
    const { error } = await service.from("study_sessions").delete().eq("id", sessionId);
    expect(error).toBeNull();
  }
});
