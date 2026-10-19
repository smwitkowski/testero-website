import { test, expect } from "@playwright/test";
import type { DiagnosticProgress } from "../lib/diagnostic/types";

for (const count of [5, 10]) {
  test(`${count}-question diagnostic preserves ownership, completion and full-length follow-up`, async ({ page, browser }) => {
    await page.goto("/diagnostic");
    await expect(page.getByRole("radio", { name: "Quick check (5)" })).toBeChecked();
    await page.getByRole("radio", { name: count === 5 ? "Quick check (5)" : "Short (10)" }).check();
    const response = page.waitForResponse(response => response.url().endsWith("/api/diagnostic") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Begin diagnostic" }).click();
    const created = await response;
    expect(created.status()).toBe(201);
    expect(created.request().postDataJSON()).toEqual({ questionCount: count });
    const { sessionId, progress } = await created.json();
    expect(progress.totalQuestions).toBe(count);
    await expect(page.getByText(`Question 1 of ${count}`, { exact: true })).toBeVisible();
    const api = `/api/diagnostic/${sessionId}`;
    const foreign = await browser.newContext();
    try { expect((await foreign.request.get(`http://127.0.0.1:3000${api}`)).status()).toBe(404); }
    finally { await foreign.close(); }
    const domains = new Set<string>();
    for (let i = 0; i < count; i++) {
      const saved = await page.request.get(api);
      const state = await saved.json() as DiagnosticProgress;
      domains.add(state.currentQuestion!.domainCode);
      const answer = await page.request.post(`${api}/answer`, { data: { itemId: state.currentQuestion!.id, selectedLabel: state.currentQuestion!.options[0].label } });
      expect(answer.status()).toBe(200);
      expect((await answer.json()).totalQuestions).toBe(count);
    }
    expect(domains.size).toBe(count === 5 ? 5 : 6);
    await page.goto(`/diagnostic/${sessionId}/results`);
    await expect(page.getByText(`Based on ${count} questions.`, { exact: false })).toBeVisible();
    expect((await page.locator('[aria-label="Overall score"]').boundingBox())!.y).toBeLessThan((await page.getByText(`Based on ${count} questions.`, { exact: false }).boundingBox())!.y);
    await expect(page.getByRole("heading", { name: "One full explanation, free", exact: true })).toBeVisible();
    await expect(page.getByText("Report a problem with this question", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Unlock PMLE Pass: $39", exact: true })).toHaveAttribute("href", "/signup?next=%2Fpricing");
    const result = await (await page.request.get(`${api}/results`)).json();
    expect(result.totalQuestions).toBe(count);
    expect(result.review).toBeUndefined();
    await page.getByRole("link", { name: "take the 20-question diagnostic →" }).click();
    await expect(page.getByRole("radio", { name: "Full readiness (20)" })).toBeChecked();
  });
}
