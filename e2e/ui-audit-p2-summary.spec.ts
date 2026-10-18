import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

test("ui-audit-p2 S07 summary arrival scroll reproduction", async ({ page }, info) => {
  test.skip(process.env.TESTERO_QA !== "1" || info.project.name !== "qa-1280", "Local seeded accounts only; both widths in one test");
  test.setTimeout(180_000);
  const directory = process.env.QA_SCREENSHOT_DIR;
  const accounts = JSON.parse(await readFile(".qa/accounts.json", "utf8"));
  const records: unknown[] = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.context().clearCookies();
    await page.goto("/login?next=/dashboard");
    await page.getByLabel("Email", { exact: true }).fill(accounts.paid.email);
    await page.getByLabel("Password", { exact: true }).fill(accounts.paid.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    const created = page.waitForResponse(response => response.url().endsWith("/api/practice") && response.request().method() === "POST");
    await page.getByRole("button", { name: /^(?:Practice |Start practice$)/ }).first().click();
    const response = await created;
    expect(response.status()).toBe(201);
    const { sessionId } = await response.json();
    for (let ordinal = 1; ordinal <= 5; ordinal++) {
      await expect(page.getByText(`Question ${ordinal} of 5`, { exact: true })).toBeVisible();
      await page.getByRole("radio").first().check();
      const saved = page.waitForResponse(response => response.url().endsWith(`/api/practice/${sessionId}/answer`) && response.request().method() === "POST");
      await page.getByRole("button", { name: "Submit answer", exact: true }).click();
      expect((await saved).status()).toBe(200);
      if (ordinal < 5) await page.getByRole("button", { name: "Next question", exact: true }).click();
    }
    const summary = page.getByRole("link", { name: "View summary", exact: true });
    await expect(summary).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await summary.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => ({ scrollY, height: innerHeight, documentHeight: document.documentElement.scrollHeight }));
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let intercepted = false;
    // Deliberate pending fixture only: retain the real local response, release after arrival measurement.
    await page.route(`**/api/practice/${sessionId}/summary`, async route => {
      const response = await route.fetch(); intercepted = true;
      await gate; await route.fulfill({ response });
    });
    await summary.click();
    await expect(page).toHaveURL(new RegExp(`/practice/${sessionId}/summary$`));
    await expect.poll(() => intercepted).toBe(true);
    await expect(page.getByRole("status")).toHaveText("Loading your practice summary…");
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    const arrival = await page.evaluate(() => ({ scrollY, height: innerHeight, documentHeight: document.documentElement.scrollHeight }));
    if (directory) { await mkdir(directory, { recursive: true }); await page.screenshot({ path: `${directory}/s07-summary-pending-${width}.png`, fullPage: true }); }
    release();
    await expect(page.getByRole("heading", { name: "Your practice summary", exact: true })).toBeVisible();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole("heading", { name: "Your practice summary", exact: true })).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    const resolved = await page.evaluate(() => ({ scrollY, height: innerHeight, documentHeight: document.documentElement.scrollHeight }));
    if (directory) await page.screenshot({ path: `${directory}/s07-summary-resolved-${width}.png`, fullPage: true });
    await page.unroute(`**/api/practice/${sessionId}/summary`);
    records.push({ width, before, arrival, resolved, fixture: "real local summary response held until arrival scroll was recorded" });
  }
  if (directory) await writeFile(`${directory}/s07-scroll.json`, JSON.stringify(records, null, 2));
});
