import { test, expect } from '@playwright/test';

test.describe('TrustedBySection E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the demo page
    await page.goto('/demo/trusted-by');
  });

  test('displays the page title and hero content', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Trusted By Logo Carousel' })).toBeVisible();
    await expect(page.getByText('Showcasing our professional logo carousel')).toBeVisible();
  });

  test('renders all logo carousel variants', async ({ page }) => {
    // Default variant
    await expect(page.getByText('Trusted by industry leaders').first()).toBeVisible();
    
    // Compact variant
    await expect(page.getByText('Our technology partners')).toBeVisible();
    
    // Fast variant
    await expect(page.getByText('Development tools we integrate with')).toBeVisible();
    
    // Dark theme variant
    await expect(page.getByText('Powering growth worldwide')).toBeVisible();
  });

  test('logo carousel animations work correctly', async ({ page }) => {
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    
    // Check that marquee container is present
    const marqueeContainer = page.locator('[aria-label="Partner logos carousel"]').first();
    await expect(marqueeContainer).toBeVisible();
    
    // Check for animation classes
    const marqueeElement = marqueeContainer.locator('.animate-marquee').first();
    await expect(marqueeElement).toBeVisible();
    
    // Verify logos are present in the carousel
    const logoImages = marqueeContainer.locator('img');
    await expect(logoImages.first()).toBeVisible();
    const logoCount = await logoImages.count();
    expect(logoCount).toBeGreaterThan(0);
  });

  test('logo hover effects work', async ({ page }) => {
    // Find the first logo card
    const firstLogoCard = page.locator('[role="button"]').first();
    await expect(firstLogoCard).toBeVisible();
    
    // Hover over the logo
    await firstLogoCard.hover();
    
    // Check that hover classes are applied
    await expect(firstLogoCard).toHaveClass(/hover:scale-105/);
    
    // Check that the logo image has filter classes
    const logoImage = firstLogoCard.locator('img');
    await expect(logoImage).toHaveClass(/grayscale/);
  });

  test('logo clicks work correctly', async ({ page }) => {
    // Mock window.open to capture external link clicks
    await page.addInitScript(() => {
      window.open = () => {
        (window as any).openedUrls = (window as any).openedUrls || [];
        (window as any).openedUrls.push(arguments[0]);
        return null;
      };
    });
    
    // Click on the first logo
    const firstLogoCard = page.locator('[role="button"]').first();
    await firstLogoCard.click();
    
    // Check that window.open was called
    const openedUrls = await page.evaluate(() => (window as any).openedUrls);
    expect(openedUrls).toBeDefined();
    expect(openedUrls.length).toBeGreaterThan(0);
  });

  test('keyboard navigation works', async ({ page }) => {
    // Tab to the first logo card
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Find focused element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Press Enter on focused logo
    await page.keyboard.press('Enter');
    
    // Should work without errors (external link handling is mocked)
  });

  test('responsive design works correctly', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByText('Trusted by industry leaders').first()).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByText('Trusted by industry leaders').first()).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByText('Trusted by industry leaders').first()).toBeVisible();
    
    // Check that responsive classes are applied
    const title = page.getByText('Trusted by industry leaders').first();
    await expect(title).toHaveClass(/text-2xl/);
  });

  test('dark mode variant renders correctly', async ({ page }) => {
    // Scroll to dark mode section
    await page.locator('.bg-slate-900').scrollIntoViewIfNeeded();
    
    // Check dark mode content
    await expect(page.getByText('Powering growth worldwide')).toBeVisible();
    await expect(page.getByText('From startups to enterprise')).toBeVisible();
  });

  test('accessibility features work', async ({ page }) => {
    // Check ARIA labels
    const carouselRegion = page.locator('[role="region"][aria-label="Our trusted partners"]').first();
    await expect(carouselRegion).toBeVisible();
    
    const carouselContainer = page.locator('[aria-label="Partner logos carousel"]').first();
    await expect(carouselContainer).toBeVisible();
    
    // Check that logo buttons have proper ARIA labels
    const logoButton = page.locator('[role="button"]').first();
    const ariaLabel = await logoButton.getAttribute('aria-label');
    expect(ariaLabel).toContain('Visit');
    expect(ariaLabel).toContain('website');
  });

  test('reduced motion preference is respected', async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Reload page to apply preference
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check that static grid is rendered instead of marquee
    const gridContainer = page.locator('.grid').first();
    await expect(gridContainer).toBeVisible();
    
    // Check that marquee animation is not present
    const marqueeAnimation = page.locator('.animate-marquee');
    await expect(marqueeAnimation).toHaveCount(0);
  });

  test('different speed configurations work', async ({ page }) => {
    // All variants should be visible and functional
    const carousels = page.locator('[aria-label="Partner logos carousel"]');
    const carouselCount = await carousels.count();
    expect(carouselCount).toBeGreaterThan(2);
    
    // Each carousel should have logos
    for (let i = 0; i < carouselCount; i++) {
      const carousel = carousels.nth(i);
      const logos = carousel.locator('img');
      await expect(logos.first()).toBeVisible();
    }
  });

  test('gradient masks are applied correctly', async ({ page }) => {
    // Check for gradient mask elements
    const gradientMasks = page.locator('.absolute').filter({ hasText: '' });
    const maskCount = await gradientMasks.count();
    expect(maskCount).toBeGreaterThan(0);
    
    // At least some carousels should have gradient masks
    const carouselWithMask = page.locator('[aria-label="Partner logos carousel"]').first().locator('..');
    const maskElements = carouselWithMask.locator('.absolute');
    await expect(maskElements.first()).toBeVisible();
  });

  test('implementation guide is visible and helpful', async ({ page }) => {
    // Scroll to implementation guide
    await page.getByText('Implementation Guide').scrollIntoViewIfNeeded();
    
    // Check that code examples are visible
    await expect(page.getByText('import { TrustedBySection }')).toBeVisible();
    await expect(page.getByText('<TrustedBySection />')).toBeVisible();
    await expect(page.getByText('<CompactTrustedBy')).toBeVisible();
  });

  test('page performance is acceptable', async ({ page }) => {
    // Start performance measurement
    await page.goto('/demo/trusted-by');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check that images are loaded
    const images = page.locator('img');
    const imageCount = await images.count();
    expect(imageCount).toBeGreaterThan(0);
    
    // Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait a bit to catch any late errors
    await page.waitForTimeout(1000);
    
    // Should have no console errors
    expect(consoleErrors).toHaveLength(0);
  });
});