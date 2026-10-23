import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { DiagnosticStartResponse } from "../lib/diagnostic/types";

const sessions = new Set<string>();
test.afterEach(async () => {
  if (!sessions.size) return;
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
  expect(url.port).toBe("56541");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await service.from("study_sessions").delete().in("id", [...sessions]);
  expect(error).toBeNull();
  sessions.clear();
});

for (const width of [1280, 375]) {
  test(`paid ${width}px CTA starts while saved-progress lookup is held`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    let lookups = 0;
    let posts = 0;
    await page.route("**/api/diagnostic", async route => {
      if (route.request().method() === "POST") { posts++; return route.continue(); }
      if (++lookups !== 1) return route.continue();
      entered();
      await held;
      // Start aborts the obsolete request. Do not try to fulfill a canceled route.
      await route.abort("aborted");
    });
    try {
      await page.goto("/diagnostic?length=5&src=ad");
      await started;
      const cta = page.getByRole("button", { name: "Start the 5-question check", exact: true });
      await expect(cta).toBeEnabled();
      const box = await cta.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThan(812);
      await expect(page.getByText("Checking for saved progress…", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("radio").first()).not.toBeVisible();
      const response = page.waitForResponse(value => new URL(value.url()).pathname === "/api/diagnostic" && value.request().method() === "POST");
      await cta.click();
      const created = await response;
      expect(created.status()).toBe(201);
      const data = await created.json() as DiagnosticStartResponse;
      sessions.add(data.sessionId);
      await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
      expect(posts).toBe(1);
      release();
      await page.goBack();
      await expect(page).toHaveURL(/\/diagnostic\?length=5&src=ad$/);
      await expect(page.getByRole("link", { name: "Continue where I left off", exact: true })).toHaveAttribute("href", `/diagnostic/${data.sessionId}`);
      await page.goForward();
      await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
      expect(posts).toBe(1);
    } finally { release(); }
  });
}

test("returning paid visitor resumes owned answers without creating a new check", async ({ page, context, browser }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const created = await page.request.post("/api/diagnostic", { data: { questionCount: 5 } });
  expect(created.status()).toBe(201);
  const data = await created.json() as DiagnosticStartResponse;
  sessions.add(data.sessionId);
  const question = data.progress.currentQuestion!;
  const saved = await page.request.post(`/api/diagnostic/${data.sessionId}/answer`, { data: { itemId: question.id, selectedLabel: question.options[0].label } });
  expect(saved.status()).toBe(200);
  const before = (await context.cookies()).find(cookie => cookie.name === "testero_anon");
  expect(before).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  let posts = 0;
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/diagnostic") posts++; });
  await page.goto("/diagnostic?length=5&src=ad");
  const resume = page.getByRole("link", { name: "Continue where I left off", exact: true });
  await expect(resume).toHaveAttribute("href", `/diagnostic/${data.sessionId}`);
  const box = await resume.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(812);
  await resume.click();
  await expect(page.getByText("Question 2 of 5", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Diagnostic progress" })).toHaveAttribute("aria-valuenow", "1");
  expect(posts).toBe(0);
  expect((await context.cookies()).find(cookie => cookie.name === "testero_anon")?.value).toBe(before?.value);
  const foreign = await browser.newContext();
  try { expect((await foreign.request.get(`http://127.0.0.1:3000/api/diagnostic/${data.sessionId}`)).status()).toBe(404); }
  finally { await foreign.close(); }
});

test("failed lookup does not block a fresh manual start", async ({ page }) => {
  await page.route("**/api/diagnostic", async route => {
    if (route.request().method() === "GET") return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    await route.continue();
  });
  await page.goto("/diagnostic?length=5&src=ad");
  await expect(page.getByRole("button", { name: "Retry saved progress", exact: true })).toBeVisible();
  const cta = page.getByRole("button", { name: "Start the 5-question check", exact: true });
  await expect(cta).toBeEnabled();
  const response = page.waitForResponse(value => new URL(value.url()).pathname === "/api/diagnostic" && value.request().method() === "POST");
  await cta.click();
  const created = await response;
  expect(created.status()).toBe(201);
  sessions.add((await created.json() as DiagnosticStartResponse).sessionId);
  await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
});

test.describe("Google Ads final-URL checker", () => {
  test.use({ userAgent: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; Mozilla/5.0, Google-AdWords-Express) Chrome/153..." });
  test("does not create a session automatically, but an explicit click still works", async ({ page }) => {
    let posts = 0;
    await page.route("**/api/diagnostic", async route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { resumeId: null } });
      posts++;
      await route.continue();
    });
    const lookup = page.waitForResponse(value => new URL(value.url()).pathname === "/api/diagnostic" && value.request().method() === "GET");
    await page.goto("/diagnostic?start=1&length=5");
    await lookup;
    // Wait through hydration and passive effects, not just server-rendered HTML.
    await page.waitForLoadState("networkidle");
    expect(posts).toBe(0);
    const cta = page.getByRole("button", { name: "Start the 5-question check", exact: true });
    await expect(cta).toBeEnabled();
    const response = page.waitForResponse(value => new URL(value.url()).pathname === "/api/diagnostic" && value.request().method() === "POST");
    await cta.click();
    const created = await response;
    expect(created.status()).toBe(201);
    sessions.add((await created.json() as DiagnosticStartResponse).sessionId);
    await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
    expect(posts).toBe(1);
  });
});
