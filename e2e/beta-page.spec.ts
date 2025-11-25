import { test, expect } from '@playwright/test';

test.describe('Beta Page Redirect Tests', () => {
  test('should redirect /beta to /pricing', async ({ page }) => {
    await page.goto('/beta');
    // Wait for redirect to complete
    await page.waitForURL('**/pricing', { timeout: 5000 });
    await expect(page).toHaveURL(/\/pricing/);
  });

  test('should redirect /beta/welcome to /diagnostic', async ({ page }) => {
    await page.goto('/beta/welcome');
    // Wait for redirect to complete
    await page.waitForURL('**/diagnostic', { timeout: 5000 });
    await expect(page).toHaveURL(/\/diagnostic/);
  });
});