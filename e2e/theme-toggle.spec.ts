import { expect, test } from "@playwright/test";

const TOGGLE_NAME = /toggle dark mode/i;

async function getHtmlHasDark(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.classList.contains("dark"));
}

test("theme toggle switches between light and dark themes", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("ui-theme");
  });
  await page.goto("/");

  const initialHasDark = await getHtmlHasDark(page);

  // Default theme is light, so initial state should be light (no dark class)
  expect(initialHasDark).toBe(false);

  const toggle = page.getByRole("button", { name: TOGGLE_NAME });

  await toggle.click();

  const afterFirstToggle = await getHtmlHasDark(page);
  expect(afterFirstToggle).not.toBe(initialHasDark);

  await toggle.click();

  const afterSecondToggle = await getHtmlHasDark(page);
  expect(afterSecondToggle).toBe(initialHasDark);
});
