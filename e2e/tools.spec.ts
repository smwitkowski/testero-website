import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("free tools work on desktop and mobile without a question bank", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const screenshots = process.env.TESTERO_SCREENSHOTS;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const slug of ["", "which-google-cloud-certification", "study-plan", "exam-guide-changes"]) {
      const response = await page.goto(`/tools${slug ? `/${slug}` : ""}`);
      expect(response?.status()).toBe(200);
      expect(response?.headers()["set-cookie"]).toBeUndefined();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (slug === "which-google-cloud-certification") {
        await page.getByLabel("4. What do you want to focus on?").selectOption("ml");
        await page.getByLabel("2. How long have you used Google Cloud?").selectOption("one-year");
        await page.getByLabel("3. How much relevant industry experience do you have?").selectOption("experienced");
        await page.getByLabel("5. What is your certification goal?").selectOption("specialize");
        await page.getByRole("button", { name: "Show my matches" }).focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("#picker-result")).toBeFocused();
        await expect(page.getByRole("link", { name: "Start PMLE diagnostic" })).toBeVisible();
        const shared = page.url();
        await page.getByRole("button", { name: "Copy result link" }).click();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shared);
        await page.reload();
        await expect(page.locator("#picker-result")).toBeVisible();
        await page.getByLabel("4. What do you want to focus on?").selectOption("workspace");
        await page.getByRole("button", { name: "Show my matches" }).click();
        await expect(page.getByLabel("Get notified when the Associate Google Workspace Administrator diagnostic is ready")).toBeVisible();
        await page.route("**/api/cert-waitlist", async route => {
          expect(route.request().postDataJSON()).toMatchObject({ cert_id: "associate-google-workspace-administrator", source_path: "/tools/which-google-cloud-certification" });
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "You're on the list" }) });
        });
        await page.getByLabel("Get notified when the Associate Google Workspace Administrator diagnostic is ready").fill("tool-check@example.test");
        await page.getByRole("complementary", { name: "Associate Google Workspace Administrator diagnostic", exact: true }).getByRole("button", { name: "Notify me", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "You're on the list" })).toBeVisible();
        expect(await page.locator('label[for="cert-email-associate-google-workspace-administrator"]').count()).toBe(0);
        await page.unroute("**/api/cert-waitlist");
      }
      if (slug === "study-plan") {
        const exam = new Date(); exam.setDate(exam.getDate() + 28);
        const examDate = `${exam.getFullYear()}-${String(exam.getMonth() + 1).padStart(2, "0")}-${String(exam.getDate()).padStart(2, "0")}`;
        await page.getByLabel("Exam date", { exact: true }).fill(examDate);
        await page.getByLabel("Study hours per week").fill("5");
        await page.getByRole("button", { name: "Create study plan" }).click();
        await expect(page.locator("#plan-result")).toBeFocused();
        await page.getByRole("button", { name: "Copy schedule as text" }).click();
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(copied).toContain("Week 4"); expect(copied).toContain("total 101%");
        await page.getByLabel("Certification", { exact: true }).selectOption("data-engineer");
        await page.getByRole("button", { name: "Create study plan" }).click();
        await expect(page.getByLabel("Get notified when the Professional Data Engineer diagnostic is ready")).toBeVisible();
      }
      if (slug === "exam-guide-changes") {
        expect(await page.locator("section[id]").count()).toBe(15);
        await page.getByText("Get notified about this diagnostic", { exact: true }).first().click();
        await expect(page.getByLabel("Get notified when the Professional Agentic Architect diagnostic is ready")).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const ids = await page.locator("[id]").evaluateAll(nodes => nodes.map(node => node.id));
      expect(new Set(ids).size).toBe(ids.length);
      if (screenshots) await page.screenshot({ path: path.join(screenshots, `${slug || "tools-index"}-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});
