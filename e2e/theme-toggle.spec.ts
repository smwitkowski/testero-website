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

  const initialPrefersDark = await page.evaluate(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const initialHasDark = await getHtmlHasDark(page);

  // Ensure initial state aligns with preference when using system theme
  if (initialPrefersDark) {
    expect(initialHasDark).toBe(true);
  }

  const toggle = page.getByRole("button", { name: TOGGLE_NAME });

  await toggle.click();

  const afterFirstToggle = await getHtmlHasDark(page);
  expect(afterFirstToggle).not.toBe(initialHasDark);

  await toggle.click();

  const afterSecondToggle = await getHtmlHasDark(page);
  expect(afterSecondToggle).toBe(initialHasDark);
});
