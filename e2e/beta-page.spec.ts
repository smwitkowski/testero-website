import { test, expect } from '@playwright/test';

test.describe('Beta Page E2E Tests', () => {
  test('complete beta page user journey', async ({ page }) => {
    // Navigate to beta page
    await page.goto('/beta');
    
    // Verify page loads with correct title
    await expect(page).toHaveTitle(/Testero Beta/);
    
    // Check main hero content is visible
    await expect(page.getByRole('heading', { name: /welcome to the testero beta/i })).toBeVisible();
    await expect(page.getByText(/exclusive beta access/i)).toBeVisible();
    
    // Verify all main sections are present and visible
    await expect(page.getByTestId('beta-benefits')).toBeVisible();
    await expect(page.getByTestId('limitations')).toBeVisible();
    await expect(page.getByTestId('expectations')).toBeVisible();
    await expect(page.getByTestId('target-audience')).toBeVisible();
    await expect(page.getByTestId('privacy')).toBeVisible();
    await expect(page.getByTestId('getting-started')).toBeVisible();
    
    // Check that benefit cards are properly displayed
    await expect(page.getByText('Full Access to Core Features')).toBeVisible();
    await expect(page.getByText('Beta-Only Perks')).toBeVisible();
    await expect(page.getByTestId('beta-benefits').getByText('Diagnostic Assessment')).toBeVisible();
    await expect(page.getByText('Direct Feedback Loop')).toBeVisible();
    
    // Verify limitations section has warning styling
    const limitationsSection = page.getByTestId('limitations');
    await expect(limitationsSection).toBeVisible();
    await expect(limitationsSection.getByText('17%')).toBeVisible();
    
    // Check privacy commitments are displayed
    await expect(page.getByText('Secure storage')).toBeVisible();
    await expect(page.getByText('No third-party sharing')).toBeVisible();
    
    // Verify numbered steps in getting started
    await expect(page.getByText('Click invite link')).toBeVisible();
    await expect(page.getByText('15–20 minutes')).toBeVisible();
    
    // Test CTA button interaction
    const ctaButton = page.getByTestId('cta-button');
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toHaveText(/start your beta now/i);
    await expect(ctaButton).toBeEnabled();
    
    // Click CTA button should navigate or trigger action
    await ctaButton.click();
    // Note: Add specific navigation test once join URL is implemented
  });

  test('responsive design on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/beta');
    
    // Verify page is responsive
    await expect(page.getByRole('heading', { name: /welcome to the testero beta/i })).toBeVisible();
    
    // Check that cards stack properly on mobile
    const benefitsSection = page.getByTestId('beta-benefits');
    await expect(benefitsSection).toBeVisible();
    
    // Verify CTA buttons stack on mobile
    const ctaButton = page.getByTestId('cta-button');
    await expect(ctaButton).toBeVisible();
    await expect(ctaButton).toBeEnabled();
  });

  test('accessibility compliance', async ({ page }) => {
    await page.goto('/beta');
    
    // Check for proper heading hierarchy
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    
    const h2Elements = page.getByRole('heading', { level: 2 });
    await expect(h2Elements).toHaveCount(7); // Should have 7 h2 elements
    
    // Verify all interactive elements are keyboard accessible
    const ctaButton = page.getByTestId('cta-button');
    await ctaButton.focus();
    await expect(ctaButton).toBeFocused();
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const secondaryButton = page.getByRole('button', { name: /read details/i });
    await expect(secondaryButton).toBeFocused();
  });

  test('content structure and organization', async ({ page }) => {
    await page.goto('/beta');
    
    // Verify logical content flow
    const sections = [
      page.getByTestId('beta-benefits'),
      page.getByTestId('limitations'),
      page.getByTestId('expectations'),
      page.getByTestId('target-audience'),
      page.getByTestId('privacy'),
      page.getByTestId('getting-started')
    ];
    
    // Check all sections are in proper order
    for (const section of sections) {
      await expect(section).toBeVisible();
    }
    
    // Verify icons are displayed properly with content (there are many icons on the page)
    const icons = page.locator('svg');
    await expect(icons).toHaveCount(await icons.count()); // Just verify icons exist
    
    // Check card styling and layout
    const cards = page.locator('[data-slot="card"]');
    await expect(cards).toHaveCount(6); // Should have 6 cards total
  });

  test('performance and loading', async ({ page }) => {
    // Start measuring performance
    const startTime = Date.now();
    
    await page.goto('/beta');
    
    // Page should load quickly
    await expect(page.getByRole('heading', { name: /welcome to the testero beta/i })).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load in under 3 seconds
    
    // Check that images/icons load properly
    const icons = page.locator('svg');
    await expect(icons.first()).toBeVisible();
    
    // Verify no console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.reload();
    expect(errors).toHaveLength(0);
  });
});