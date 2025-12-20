import { test, expect } from '@playwright/test';

test.describe('Blog Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page to enable localStorage access
    await page.goto('/');
  });

  test('should navigate from blog post CTA to diagnostic page', async ({ page }) => {
    // Navigate to blog index first to get a valid slug
    await page.goto('/blog');
    
    // Wait for blog posts to load
    await page.waitForSelector('article, [class*="BlogCard"]', { timeout: 10000 });
    
    // Find the first blog post link and get its href
    const firstPostLink = page.locator('a[href^="/blog/"]').first();
    const postHref = await firstPostLink.getAttribute('href');
    
    if (!postHref) {
      test.skip();
      return;
    }
    
    // Navigate to the blog post
    await page.goto(postHref);
    
    // Wait for the page to load and verify we're on a blog post page
    await expect(page).toHaveURL(new RegExp(`^${process.env.BASE_URL || 'http://localhost:3000'}/blog/`));
    
    // Find the "Start Free Diagnostic" CTA link
    const diagnosticLink = page.getByRole('link', { name: /Start Free Diagnostic/i });
    
    // Verify the link exists and has the correct href
    await expect(diagnosticLink).toBeVisible();
    await expect(diagnosticLink).toHaveAttribute('href', '/diagnostic');
    
    // Click the CTA
    await diagnosticLink.click();
    
    // Verify navigation to diagnostic page
    await expect(page).toHaveURL(new RegExp(`^${process.env.BASE_URL || 'http://localhost:3000'}/diagnostic`));
    
    // Verify diagnostic page loaded (check for diagnostic-specific content)
    await expect(page.locator('h1, [class*="diagnostic"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate from blog index card to blog post', async ({ page }) => {
    // Navigate to blog index
    await page.goto('/blog');
    
    // Wait for blog posts to load
    await page.waitForSelector('article, a[href^="/blog/"]', { timeout: 10000 });
    
    // Find the first blog post card/link
    const firstPostCard = page.locator('a[href^="/blog/"]').first();
    
    // Get the expected URL
    const expectedHref = await firstPostCard.getAttribute('href');
    
    if (!expectedHref) {
      test.skip();
      return;
    }
    
    // Click anywhere on the card (not just the title)
    await firstPostCard.click();
    
    // Verify navigation to blog post
    await expect(page).toHaveURL(new RegExp(`^${process.env.BASE_URL || 'http://localhost:3000'}${expectedHref}`));
    
    // Verify blog post content loaded
    await expect(page.locator('article, [class*="prose"]').first()).toBeVisible({ timeout: 5000 });
  });
});
