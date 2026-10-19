import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { DiagnosticProgress } from "../lib/diagnostic/types";

const directory = process.env.TESTERO_P1_SCREENSHOTS;
async function capture(page: Page, name: string) {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    if (new URL(page.url()).pathname === "/dashboard") await expect(page.locator("header").getByRole("link", { name: "Dashboard", exact: true }).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (directory) {
      await mkdir(directory, { recursive: true });
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({ path: `${directory}/${name}-${width}.png`, fullPage: true });
    }
  }
}
async function diagnostic(page: Page, count: number) {
  const response = await page.request.post("/api/diagnostic", { data: { questionCount: count } });
  expect(response.status()).toBe(201);
  const { sessionId } = await response.json();
  for (let index = 0; index < count; index++) {
    const progress = await (await page.request.get(`/api/diagnostic/${sessionId}`)).json() as DiagnosticProgress;
    const question = progress.currentQuestion!;
    expect((await page.request.post(`/api/diagnostic/${sessionId}/answer`, { data: { itemId: question.id, selectedLabel: question.options[0].label } })).status()).toBe(200);
  }
  await page.goto(`/diagnostic/${sessionId}/results`);
  await expect(page.getByRole("heading", { name: "PMLE readiness report", exact: true })).toBeVisible();
  return sessionId;
}

test("P1 audit: stable manual previews, PMLE discovery and anonymous/free/paid results", async ({ page }, info) => {
  test.skip(process.env.TESTERO_QA !== "1" || info.project.name !== "qa-1280", "Uses seeded local QA accounts once");
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const heights: Record<string, number[]> = {};
  const fonts: unknown[] = [];
  await page.goto("/");
  const preview = page.getByRole("region", { name: "Certification readiness previews" });
  await expect(preview.getByRole("heading", { name: "Machine Learning Engineer", exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: /Play previews|Pause previews/ })).toHaveCount(0);
  // A virtual clock proves the slide cannot advance on a timer.
  await page.clock.install(); await page.clock.fastForward(30_000);
  await expect(preview.getByRole("heading", { name: "Machine Learning Engineer", exact: true })).toBeVisible();
  await page.clock.resume();
  await capture(page, "home-pmle");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    heights[String(width)] = [];
    for (let slide = 0; slide < 4; slide++) {
      await page.evaluate(() => document.fonts.ready);
      heights[String(width)].push((await preview.locator('[data-slot="card"]').boundingBox())!.height);
      if (directory) await page.screenshot({ path: `${directory}/home-slide-${slide + 1}-${width}.png`, fullPage: true });
      await preview.getByRole("button", { name: "Next certification", exact: true }).click();
    }
    expect(Math.max(...heights[String(width)]) - Math.min(...heights[String(width)])).toBeLessThanOrEqual(1);
    fonts.push(await page.evaluate(() => ({ width: innerWidth, medium: document.fonts.check('500 16px "Testero IBM Plex Sans"'), regular: document.fonts.check('400 16px "Testero IBM Plex Sans"'), semibold: document.fonts.check('600 16px "Testero IBM Plex Sans"'), faces: [...document.fonts].filter(face => face.family.includes("Testero")).map(face => ({ family: face.family, weight: face.weight, status: face.status })) })));
    expect(await page.evaluate(() => document.fonts.check('500 16px "Testero IBM Plex Sans"'))).toBe(true);
  }
  await page.goto("/certifications");
  await expect(page.locator("details#professional")).toHaveAttribute("open", "");
  await expect(page.locator("details#professional li").first().getByRole("heading")).toContainText("Professional Machine Learning Engineer");
  await expect(page.getByRole("link", { name: "Start the free PMLE diagnostic →", exact: true })).toBeVisible();
  await capture(page, "certifications");
  await page.goto("/pricing"); await capture(page, "pricing");
  for (const count of [5, 10, 20]) {
    await diagnostic(page, count);
    await expect(page.getByRole("heading", { name: "One full explanation, free", exact: true })).toBeVisible();
    await expect(page.locator("[data-question-review-items] > li")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Question review", exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Question review navigation" })).toHaveCount(0);
    const unlock = page.getByRole("link", { name: "Unlock PMLE Pass: $39", exact: true });
    await expect(unlock).toBeVisible();
    const order = await page.evaluate(() => ["#domains-heading", "#free-explanation-heading", '[aria-label="Unlock PMLE Pass"]', "#email-results-heading"].map(selector => document.querySelector(selector)!.getBoundingClientRect().top));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    await expect(page.getByRole("button", { name: "Email my results", exact: true })).not.toHaveClass(/bg-primary/);
    if (count < 20) {
      const score = page.locator('[aria-label="Overall score"]');
      const note = page.getByText(`Based on ${count} questions.`, { exact: false });
      expect((await score.boundingBox())!.y).toBeLessThan((await note.boundingBox())!.y);
      await expect(note.getByRole("link")).toHaveAttribute("href", "/diagnostic?length=20");
    }
    await capture(page, `anonymous-results-${count}`);
  }
  const accounts = JSON.parse(await readFile(".qa/accounts.json", "utf8"));
  for (const kind of ["free", "paid"]) {
    await page.context().clearCookies();
    await page.goto("/login?next=/dashboard");
    await page.getByLabel("Email", { exact: true }).fill(accounts[kind].email);
    await page.getByLabel("Password", { exact: true }).fill(accounts[kind].password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    const sessionId = await diagnostic(page, 10);
    await expect(page.getByRole("heading", { name: "Question review", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Email me my results + a 4-week plan", exact: true })).toHaveCount(0);
    const access = await (await page.request.get("/api/billing/access")).json();
    expect(access.owned).toBe(kind === "paid");
    if (kind === "free") await expect(page.getByRole("button", { name: "Unlock PMLE Pass: $39", exact: true })).toBeVisible();
    else await expect(page.getByRole("region", { name: "Unlock PMLE Pass", exact: true })).toHaveCount(0);
    await capture(page, `${kind}-results`);
    await expect(page.locator("header").getByRole("link", { name: "Start free", exact: true })).toHaveCount(0);
    await expect(page.locator("header").getByRole("link", { name: "Dashboard", exact: true }).first()).toBeVisible();
    if (kind === "free") {
      const request = page.waitForResponse(response => response.url().endsWith("/api/billing/checkout") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Unlock PMLE Pass: $39", exact: true }).click();
      expect((await request).status()).toBe(200);
      await expect(page).toHaveURL(/\/checkout\/success\?session_id=cs_/);
      await page.goto(`/diagnostic/${sessionId}/results`);
    }
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Latest diagnostic by domain", exact: true })).toBeVisible();
    await capture(page, `${kind}-dashboard`);
    await expect(page.locator('[aria-label="Domain results, weakest first"]')).toBeVisible();
    await expect(page.locator('[aria-label="Domain results, weakest first"] dt')).toHaveCount(6);
    await expect(page.locator('[aria-label="Domain results, weakest first"] dd').first()).toContainText(/of .* correct/);
  }
  expect(errors).toEqual([]);
  if (directory) await writeFile(`${directory}/browser-checks.json`, JSON.stringify({ heights, fonts, errors, productionWrites: false, stripe: "local fake transport only" }, null, 2));
});
