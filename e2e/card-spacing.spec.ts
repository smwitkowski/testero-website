import { test, expect } from '@playwright/test';

test.describe('Card Spacing Tokens', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the Supabase auth to simulate logged in user
    await page.addInitScript(() => {
      // Mock localStorage for auth state
      window.localStorage.setItem('sb-' + 'test' + '-auth-token', JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        user: {
          id: 'test-user-id',
          email: 'test@example.com'
        }
      }));
    });

    // Mock the main dashboard API (for diagnostic/practice lists)
    await page.route('**/api/dashboard', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            diagnostic: {
              recentSessions: [],
              totalSessions: 0
            },
            practice: {
              totalQuestionsAnswered: 120,
              correctAnswers: 85,
              accuracyPercentage: 71,
              lastPracticeDate: null
            },
            readinessScore: 0
          }
        })
      });
    });

    // Mock the readiness summary API
    await page.route('**/api/dashboard/summary?examKey=pmle', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            examKey: 'pmle',
            currentReadinessScore: 71,
            currentReadinessTier: {
              id: 'building',
              label: 'Building',
              description: 'Building your knowledge base.'
            },
            lastDiagnosticDate: '2024-01-15T10:00:00Z',
            lastDiagnosticSessionId: 'session-123',
            totalDiagnosticsCompleted: 1,
            hasCompletedDiagnostic: true
          }
        })
      });
    });
  });

  test('Card components have correct padding', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find a Card element using the data-slot attribute
    const card = page.locator('[data-slot="card"]').first();
    await expect(card).toBeVisible();
    
    // Verify computed padding is non-zero
    const padding = await card.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        left: computed.paddingLeft,
        right: computed.paddingRight,
        top: computed.paddingTop,
        bottom: computed.paddingBottom,
      };
    });
    
    // Should have padding (not 0px)
    expect(padding.left).not.toBe('0px');
    expect(padding.right).not.toBe('0px');
    expect(padding.top).not.toBe('0px');
    expect(padding.bottom).not.toBe('0px');
    
    // Verify padding values match expected design tokens
    // Medium cards should have 16px (1rem) on mobile, 24px (1.5rem) on desktop
    // We'll check that padding is at least 12px (0.75rem) to ensure tokens are working
    const leftPaddingValue = parseFloat(padding.left);
    const topPaddingValue = parseFloat(padding.top);
    
    expect(leftPaddingValue).toBeGreaterThanOrEqual(12); // At least 0.75rem (12px)
    expect(topPaddingValue).toBeGreaterThanOrEqual(12); // At least 0.75rem (12px)
  });

  test('CardContent has proper spacing', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find CardContent element
    const cardContent = page.locator('[data-slot="card-content"]').first();
    await expect(cardContent).toBeVisible();
    
    // Verify CardContent has proper gap spacing
    const gap = await cardContent.evaluate((el) => {
      return window.getComputedStyle(el).gap;
    });
    
    // Gap should be set (not 'normal' or '0px')
    expect(gap).not.toBe('normal');
    expect(gap).not.toBe('0px');
  });
});



