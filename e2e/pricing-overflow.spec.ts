import { test, expect } from '@playwright/test';

const mobileWidths = [320, 360, 390] as const;

test.describe('Pricing page mobile overflow guard', () => {
  for (const width of mobileWidths) {
    test(`does not overflow horizontally at ${width}px`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name.includes('Mobile'),
        'Mobile device projects already emulate constrained viewports.'
      );

      await page.setViewportSize({ width, height: 900 });
      await page.goto('/pricing');

      const hasHorizontalScroll = await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        return el.scrollWidth > el.clientWidth;
      });

      expect(hasHorizontalScroll).toBeFalsy();

      const recommendedCard = page.locator('[data-recommended="true"]');
      await expect(recommendedCard.first()).toBeVisible();
      await expect(recommendedCard.first()).toHaveClass(/ring-2/);

      const transform = await recommendedCard.first().evaluate((el) => {
        return window.getComputedStyle(el).transform;
      });

      expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();
    });
  }
});
