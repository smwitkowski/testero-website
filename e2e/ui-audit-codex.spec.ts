import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { DiagnosticProgress } from "../lib/diagnostic/types";
const directory = ".qa/codex/shots";
const manifest: unknown[] = [];
async function shot(page: Page, name: string, role: string, width: number, viewport = false) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display:none!important }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const path = `${directory}/${role}-${name}-${width}${viewport ? "-viewport" : ""}.png`;
  await page.screenshot({ path, fullPage: !viewport });
  manifest.push({ path, role, width, route: new URL(page.url()).pathname, temporaryApprovedFixture: process.env.CODEX_LEGAL_APPROVED === "1" });
}
async function diagnostic(page: Page, count: number) {
  const response = await page.request.post("/api/diagnostic", { data: { questionCount: count } });
  expect(response.status()).toBe(201);
  const { sessionId } = await response.json();
  for (let index = 0; index < count; index++) {
    const progress = await (await page.request.get(`/api/diagnostic/${sessionId}`)).json() as DiagnosticProgress;
    expect((await page.request.post(`/api/diagnostic/${sessionId}/answer`, { data: { itemId: progress.currentQuestion!.id, selectedLabel: progress.currentQuestion!.options[0].label } })).status()).toBe(200);
  }
  await page.goto(`/diagnostic/${sessionId}/results`);
  await expect(page.getByRole("heading", { name: "PMLE readiness report", exact: true })).toBeVisible();
  await expect(page.getByText("Loading your free explanation…", { exact: true })).toHaveCount(0);
}
test("Codex audit changed states at desktop and touch mobile", async ({ browser }, info) => {
  test.skip(process.env.CODEX_CAPTURE !== "1" || info.project.name !== "qa-1280");
  test.setTimeout(300_000);
  await mkdir(directory, { recursive: true });
  const accounts = JSON.parse(await readFile(".qa/accounts.json", "utf8"));
  for (const width of [1280, 390]) for (const role of ["anonymous", "free", "paid"]) {
    const context = await browser.newContext({ baseURL: "http://127.0.0.1:3000", viewport: { width, height: 844 }, isMobile: width === 390, hasTouch: width === 390, deviceScaleFactor: width === 390 ? 2 : 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    try {
      if (role !== "anonymous") {
        await page.goto("/login?next=/dashboard");
        await page.getByLabel("Email", { exact: true }).fill(accounts[role].email);
        await page.getByLabel("Password", { exact: true }).fill(accounts[role].password);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
      }
      for (const kind of ["privacy", "terms"]) {
        await page.goto(`/${kind}`);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.getByRole("heading", { name: process.env.CODEX_LEGAL_APPROVED === "1" ? kind === "privacy" ? "Who we are" : "About Testero" : "Being finalized", exact: true })).toBeVisible();
        await shot(page, `${kind}-${process.env.CODEX_LEGAL_APPROVED === "1" ? "TEMPORARY-APPROVED" : "gated"}`, role, width);
      }
      if (process.env.CODEX_LEGAL_APPROVED === "1") continue;
      for (const route of ["/pricing", "/faq", "/certifications/machine-learning-engineer", "/tools/exam-guide-changes"]) {
        await page.goto(route); await expect(page.locator("main h1")).toBeVisible();
        const name = route.split("/").at(-1)!;
        await shot(page, name, role, width);
        if (name === "machine-learning-engineer") {
          const cta = page.getByRole("link", { name: "Start PMLE diagnostic", exact: true });
          const box = await cta.boundingBox(); expect(box!.y + box!.height).toBeLessThan(844);
          await shot(page, name, role, width, true);
        }
        if (name === "exam-guide-changes") {
          const entry = page.locator("section#agentic-architect");
          await entry.getByText(/Metadata not stated by Google/).click();
          await shot(page, "tracker-expanded", role, width);
          await entry.screenshot({ path: `${directory}/${role}-tracker-agentic-detail-${width}.png` });
        }
      }
      if (role === "anonymous") {
        for (const route of ["/signup", "/signup?next=%2Fpricing"]) {
          await page.goto(route); await expect(page.locator("main h1")).toBeVisible();
          await shot(page, route.includes("next") ? "signup-paid-intent" : "signup-free", role, width);
        }
      }
      await page.goto("/");
      const preview = page.getByRole("region", { name: "Certification readiness previews" });
      for (let slide = 0; slide < 4; slide++) {
        const link = preview.getByRole("link", { name: "Explore this certification →", exact: true });
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await shot(page, `carousel-${slide + 1}`, role, width);
        await preview.getByRole("button", { name: "Next certification", exact: true }).click();
      }
      await page.goto("/pmle/sample-questions");
      await shot(page, "samples-initial", role, width);
      const sections = page.locator('section[aria-labelledby^="sample-"]');
      await sections.nth(0).getByRole("radio").first().check();
      await sections.nth(0).getByRole("button", { name: "Reveal answer and explanations", exact: true }).click();
      await shot(page, "samples-revealed", role, width);
      await sections.nth(1).getByRole("radio").nth(1).check();
      await sections.nth(1).getByRole("button", { name: "Reveal answer and explanations", exact: true }).click();
      await sections.nth(0).getByRole("button", { name: "Hide explanations", exact: true }).click();
      await expect(sections.nth(0).getByRole("status")).toBeVisible();
      await expect(sections.nth(0).getByText("✓ Correct answer", { exact: false })).toBeVisible();
      await expect(sections.nth(0).getByRole("heading", { name: "Why each option is right or wrong" })).toHaveCount(0);
      await expect(sections.nth(1).getByRole("button", { name: "Hide explanations" })).toBeVisible();
      await shot(page, "samples-hidden-feedback-retained", role, width);
      if (role === "paid") {
        const response = await page.request.post("/api/practice", { data: { domainCode: "ARCHITECTING_LOW_CODE_ML_SOLUTIONS" } });
        expect(response.status()).toBe(201);
        const { sessionId } = await response.json();
        await page.goto(`/practice/${sessionId}`);
        await expect(page.getByRole("radio").first()).toBeVisible();
        await page.getByRole("radio").first().check();
        await page.getByRole("button", { name: "Submit answer", exact: true }).click();
        await page.getByRole("button", { name: "Report a problem with this question", exact: true }).first().click();
        await shot(page, "practice-report-open", role, width);
      }
      for (const count of [5, 10, 20]) {
        await diagnostic(page, count);
        const compact = page.getByRole("link", { name: "PMLE Pass · $39 / 90 days", exact: true });
        if (role === "paid") await expect(compact).toHaveCount(0);
        else await expect(compact).toHaveAttribute("href", role === "anonymous" ? "/signup?next=%2Fpricing" : "/pricing");
        await shot(page, `results-${count}`, role, width);
        await shot(page, `results-${count}`, role, width, true);
        if (count === 5) {
          await page.getByRole("button", { name: "Report a problem with this question", exact: true }).first().click();
          for (const control of [page.getByRole("combobox").first(), page.getByLabel("Email (optional, only to follow up on this report)").first()]) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(48);
          await shot(page, "report-open", role, width);
        }
      }
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  }
  await writeFile(".qa/codex/manifest.json", JSON.stringify(manifest, null, 2));
});
