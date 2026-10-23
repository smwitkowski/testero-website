import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { DiagnosticProgress } from "../lib/diagnostic/types";

const sessionIds = new Set<string>();
test.afterEach(async () => {
  if (!sessionIds.size) return;
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
  expect(url.port).toBe("56541");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await service.from("study_sessions").delete().in("id", [...sessionIds]);
  expect(error).toBeNull();
  sessionIds.clear();
});

test("one-click start preserves progress through Browser Back, Forward and cached home navigation", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/diagnostic") posts.push(request.url());
  });
  await mkdir(".qa/site-fixup/screenshots", { recursive: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: ".qa/site-fixup/screenshots/hero-desktop.png", fullPage: true });
  const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/diagnostic" && response.request().method() === "POST");
  await page.goto("/diagnostic?start=1&length=5");
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const { sessionId } = await created.json();
  sessionIds.add(sessionId);
  await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/Correct\. The answer is [A-D]\.|Not quite\. The correct answer is [A-D]\./);
  await page.getByRole("button", { name: "Next question", exact: true }).click();
  await expect(page.getByText("Question 2 of 5", { exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/diagnostic$/);
  await expect(page.getByRole("link", { name: "Continue where I left off", exact: true })).toHaveAttribute("href", `/diagnostic/${sessionId}`);
  await expect(page.getByRole("button", { name: "Start a new 5-question check", exact: true })).toBeEnabled();
  await page.screenshot({ path: ".qa/site-fixup/screenshots/resume-desktop.png", fullPage: true });
  expect(posts).toHaveLength(1);
  await page.goForward();
  await expect(page.getByText("Question 2 of 5", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Diagnostic progress" })).toHaveAttribute("aria-valuenow", "1");
  const saved = await (await page.request.get(`/api/diagnostic/${sessionId}`)).json() as DiagnosticProgress;
  expect(saved.answeredCount).toBe(1);
  expect(saved.answeredQuestions).toHaveLength(1);

  await page.goto("/diagnostic?start=1&length=5");
  await expect(page.getByRole("link", { name: "Continue where I left off", exact: true })).toBeVisible();
  expect(posts).toHaveLength(1);
  await page.getByRole("link", { name: "Back to home", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goBack();
  await expect(page.getByRole("link", { name: "Continue where I left off", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Continue where I left off", exact: true }).click();
  await expect(page.getByText("Question 2 of 5", { exact: true })).toBeVisible();
  expect(posts).toHaveLength(1);
});

test("failed fresh-resume checks block autostart until retry succeeds", async ({ page }) => {
  let outage = true;
  let starts = 0;
  await page.route("**/api/diagnostic", async route => {
    if (route.request().method() === "GET" && outage) return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    if (route.request().method() === "POST") starts += 1;
    await route.continue();
  });
  await page.goto("/diagnostic?start=1&length=5");
  await expect(page.getByRole("button", { name: "Retry saved progress", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start the 5-question check", exact: true })).toBeEnabled();
  expect(starts).toBe(0);
  outage = false;
  const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/diagnostic" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Retry saved progress", exact: true }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  sessionIds.add((await created.json()).sessionId);
  await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
  expect(starts).toBe(1);
});
