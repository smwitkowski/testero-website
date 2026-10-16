import { test, expect } from "@playwright/test";

test("missing page has one title, noindex, and useful navigation", async ({ page }) => {
  const response = await page.goto("/qa-missing-page");
  expect(response!.status()).toBe(404);
  const html = await response!.text();
  expect(html.match(/<title>/g)).toHaveLength(1);
  await expect(page).toHaveTitle("Page not found | Testero");
  await expect(page.locator("title")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
  expect(await page.locator('meta[name="robots"]').evaluateAll(nodes => nodes.every(node => node.getAttribute("content")?.includes("noindex")))).toBe(true);
  await page.getByRole("link", { name: "Go home", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await page.goto("/qa-missing-page");
  await page.getByRole("link", { name: "Start the free diagnostic", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/diagnostic");
});
