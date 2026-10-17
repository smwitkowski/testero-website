import { armTransition, assertTransition } from "./transition-timing";
import { test, expect } from "@playwright/test";
import { captureV3 } from "./v3-capture";
import { assertRestoredSession } from "./prod-bank";
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
  if (process.env.TESTERO_V3_SCREENSHOTS) test.setTimeout(180_000);
  assertLocalDatabase();
  const failures: string[] = [];
  page.on("pageerror", error => failures.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) failures.push(`Unexpected external request: ${url.hostname}`);
  });
  if (process.env.TESTERO_V3_SCREENSHOTS) {
    for (const route of ["/", "/pricing", "/signup", "/login", "/forgot-password", "/blog", "/faq", "/terms", "/privacy"]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await page.locator("body").evaluate(body => getComputedStyle(body).fontFamily)).toContain("IBM Plex Sans");
      await captureV3(page, route === "/" ? "home" : route.slice(1));
      if (route === "/signup") {
        const signupTab = page.getByRole("tab", { name: "Create account", exact: true });
        const loginTab = page.getByRole("tab", { name: "Sign in", exact: true });
        await signupTab.focus();
        await page.keyboard.press("ArrowRight");
        await expect(loginTab).toBeFocused();
        await expect(loginTab).toHaveAttribute("aria-selected", "true");
        await page.keyboard.press("ArrowLeft");
        await expect(signupTab).toBeFocused();
        await page.keyboard.press("End");
        await expect(loginTab).toBeFocused();
        await page.keyboard.press("Home");
        await expect(signupTab).toBeFocused();
      }
      if (route === "/blog" || route === "/faq") {
        const articles = await page.locator("main li h2 a").evaluateAll(links => links.map(link => link.getAttribute("href")!));
        for (const article of articles) {
          await page.goto(article);
          await expect(page.locator("main h1")).toBeVisible();
          await captureV3(page, article.slice(1).replaceAll("/", "-"));
        }
      }
    }
  }
  await page.goto("/diagnostic");
  await captureV3(page, "diagnostic");
  const createdResponse = page.waitForResponse(response => response.url().endsWith("/api/diagnostic") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Begin diagnostic" }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const { sessionId } = await created.json() as { sessionId: string };
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    await assertRestoredSession(service, sessionId);
    const api = `/api/diagnostic/${sessionId}`;
    const initialGets: string[] = [];
    page.on("request", request => { if (request.method() === "GET" && new URL(request.url()).pathname === api) initialGets.push(request.url()); });
    const html = await (await page.request.get(`/diagnostic/${sessionId}`)).text();
    expect(html).toContain("Choose one answer");
    await expect(page).toHaveURL(new RegExp(`/diagnostic/${sessionId}$`));
    const cookie = (await context.cookies()).find(value => value.name === "testero_anon");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    expect(cookie?.value).toMatch(/^[a-f0-9]{64}$/);
    await expect(page.getByText("Question 1 of 20", { exact: true })).toBeVisible();
    expect(initialGets).toHaveLength(0);
    const firstResponse = await page.request.get(api);
    const first = await firstResponse.json() as DiagnosticProgress;
    expect(first.totalQuestions).toBe(20);
    noAnswerKeys(first);
    const earlyResults = await page.request.get(`${api}/results`);
    expect(earlyResults.status(), (await earlyResults.text()).slice(0, 180)).toBe(409);
    expect((await page.request.get(`${api}/free-explanation`)).status()).toBe(409);

    const foreign = await browser.newContext();
    try {
      for (const path of [api, `${api}/results`, `${api}/free-explanation`]) {
        const response = await foreign.request.get(`http://127.0.0.1:3000${path}`);
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({ error: "Diagnostic not found" });
      }
      const foreignWrite = await foreign.request.post(`http://127.0.0.1:3000${api}/answer`, { data: { itemId: first.currentQuestion!.id, selectedLabel: first.currentQuestion!.options[0].label } });
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
      await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
      await expect(page.getByRole("contentinfo")).toHaveCount(0);
      await expect(page.getByText(/of 20 answered/)).toHaveCount(0);
      await expect(page.getByRole("progressbar", { name: "Diagnostic progress" })).toHaveAttribute("aria-valuenow", String(index));
      await expect(page.getByText("Halfway there. Your domain picture is taking shape.", { exact: true })).toHaveCount(index === 10 ? 1 : 0);
      await expect(page.getByText("Answers can’t be changed after you submit.")).toHaveCount(0);
      if (index === 0) {
        await captureV3(page, "diagnostic-question");
        // B2: the primary button focus ring contrasts with both the blue fill and the page.
        await page.getByRole("radio").first().focus();
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Tab");
        const submit = page.getByRole("button", { name: "Next question" });
        await expect(submit).toBeFocused();
        const ring = await submit.evaluate(element => { const style = getComputedStyle(element); return { outline: style.outlineColor, width: style.outlineWidth, shadow: style.boxShadow }; });
        expect(ring).toEqual({ outline: "rgb(16, 24, 40)", width: "3px", shadow: "rgb(255, 255, 255) 0px 0px 0px 3px" });
      }
      if (index === 3) {
        // B5: starting again from /diagnostic offers to resume this browser's session.
        await page.goto("/diagnostic");
        await expect(page.getByRole("button", { name: "Begin diagnostic" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Start over" })).toBeVisible();
        await page.getByRole("link", { name: "Resume diagnostic", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/diagnostic/${sessionId}$`));
        await page.reload();
        await expect(page.getByText("Question 4 of 20", { exact: true })).toBeVisible();
        const reloaded = await (await page.request.get(api)).json() as DiagnosticProgress;
        expect(reloaded.currentQuestion).toEqual(progress.currentQuestion);
        expect(reloaded.answeredCount).toBe(3);
      }
      const nextName = index === 19 ? "See my results" : "Next question";
      if (index === 1) {
        // Selecting does not commit: change the pick, then Next sends the final one.
        const radios = page.getByRole("radio");
        await radios.nth(0).check();
        await radios.nth(1).check();
        await expect(radios.nth(1)).toBeChecked();
        await expect(radios.nth(0)).not.toBeChecked();
        expect(await (await page.request.get(api)).json()).toMatchObject({ answeredCount: 1 });
        const sent = page.waitForRequest(request => request.url().endsWith(`${api}/answer`));
        await page.getByRole("button", { name: nextName }).click();
        expect(JSON.parse((await sent).postData()!).selectedLabel).toBe(progress.currentQuestion!.options[1].label);
        await expect(page.getByText("Question 3 of 20", { exact: true })).toBeVisible();
        continue;
      }
      await page.getByRole("radio").first().check();
      if (index < 3) await armTransition(page, { path: api, ordinal: index + 2, total: 20 });
      const acceptedResponse = page.waitForResponse(response => response.url().endsWith(`${api}/answer`) && response.request().method() === "POST");
      await page.getByRole("button", { name: nextName }).click();
      const accepted = await acceptedResponse;
      expect(accepted.status()).toBe(200);
      const answer = await accepted.json() as DiagnosticAnswerResponse;
      expect(answer).toMatchObject({ answeredCount: index + 1, totalQuestions: 20, completed: index === 19, progress: { answeredCount: index + 1, currentQuestion: index === 19 ? null : { ordinal: index + 2 } } });
      noAnswerKeys(answer);
      if (index < 3) await assertTransition(page, api, "diagnostic");
    }
    await expect(page).toHaveURL(new RegExp(`/diagnostic/${sessionId}/results$`));
    await expect(page.getByRole("heading", { name: "PMLE readiness report", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Score by domain", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.locator("main").getByText(/Study guidance, not a prediction/i)).toHaveCount(1);
    await captureV3(page, "diagnostic-results");
    const resultResponse = await page.request.get(`${api}/results`);
    expect(resultResponse.status()).toBe(200);
    const result = await resultResponse.json() as DiagnosticResult;
    noAnswerKeys(result);
    const previewResponse = await page.request.get(`${api}/free-explanation`);
    expect(previewResponse.status()).toBe(200);
    expect(previewResponse.headers()["cache-control"]).toBe("private, no-store");
    const preview = await previewResponse.json();
    expect(Array.isArray(preview)).toBe(false);
    expect(preview.options).toHaveLength(4);
    expect(preview.options.every((option: { explanation?: string }) => option.explanation?.trim())).toBe(true);
    const { data: snapshot } = await service.from("session_items").select("id,ordinal,domain_code,is_correct").eq("session_id", sessionId).order("ordinal");
    const lowestDomain = [...result.domainBreakdown].sort((a, b) => a.correct * b.total - b.correct * a.total)[0];
    const domainItems = snapshot!.filter(item => item.domain_code === lowestDomain.domainCode);
    expect(preview.itemId).toBe((domainItems.find(item => item.is_correct === false) ?? domainItems[0]).id);
    expect(await (await page.request.get(`${api}/free-explanation`)).json()).toEqual(preview);
    expect((await page.request.get(`${api}/free-explanation?itemId=${snapshot![0].id}`)).status()).toBe(400);
    await expect(page.getByRole("heading", { name: "One full explanation, free", exact: true })).toBeVisible();
    await expect(page.getByText(preview.stem, { exact: true })).toBeVisible();
    expect(result.totalQuestions).toBe(20);
    expect(result.domainBreakdown).toHaveLength(6);
    expect(result.domainBreakdown.reduce((sum, domain) => sum + domain.total, 0)).toBe(20);
    expect(result.domainBreakdown.reduce((sum, domain) => sum + domain.correct, 0)).toBe(result.correctAnswers);
    expect(Object.keys(result).sort()).toEqual(["sessionId", "score", "totalQuestions", "correctAnswers", "readiness", "domainBreakdown"].sort());
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Next question|See my results/ })).toHaveCount(0);
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
    await expect(page.getByRole("heading", { name: "PMLE readiness report", exact: true })).toBeVisible();
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
