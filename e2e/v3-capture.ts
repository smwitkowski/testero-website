import { expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/** Optional local review artifacts; no auth storage or request data is saved. */
export async function captureV3(page: Page, name: string) {
  const directory = process.env.TESTERO_V3_SCREENSHOTS;
  if (!directory) return;
  if (directory !== "/Users/switkowski/Projects/Testero/hq/drafts/v3-impl-2026-10-13") throw new Error("Unexpected screenshot directory");
  await mkdir(directory, { recursive: true });
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${directory}/${name}-${width}.png`, fullPage: true });
  }
}
