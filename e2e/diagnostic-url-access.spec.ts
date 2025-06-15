import { test, expect } from '@playwright/test';
import { DiagnosticStartPage } from './helpers/page-objects/DiagnosticStartPage';
import { DiagnosticSummaryPage } from './helpers/page-objects/DiagnosticSummaryPage';
import { DiagnosticHelpers } from './helpers/diagnostic-helpers';

test.describe('Diagnostic URL Access Scenarios', () => {
  let startPage: DiagnosticStartPage;
  let summaryPage: DiagnosticSummaryPage;
  let helpers: DiagnosticHelpers;

  test.beforeEach(async ({ page }) => {
    startPage = new DiagnosticStartPage(page);
    summaryPage = new DiagnosticSummaryPage(page);
    helpers = new DiagnosticHelpers(page);

    await helpers.setupApiMocks();
    await helpers.clearLocalStorage();
  });

  test('should show error page for invalid session ID', async ({ page }) => {
    // Mock session not found
    await page.route('**/api/diagnostic**', async route => {
      const url = route.request().url();
      if (url.includes('invalid-session-id')) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session not found.' })
        });
      }
    });

    // Navigate to invalid session URL
    await page.goto('/diagnostic/invalid-session-id');

    // Should show session not found error
    await expect(page.locator('h1')).toContainText('Session Not Found');
    await expect(page.locator('text=expired or could not be found')).toBeVisible();
    
    // Should have button to start new diagnostic
    const startNewButton = page.getByRole('button', { name: /start new diagnostic/i });
    await expect(startNewButton).toBeVisible();
    
    // Button should navigate to diagnostic start page
    await startNewButton.click();
    await helpers.waitForPageLoad('/diagnostic');
    await startPage.expectPageTitle();
  });

  test('should show error when accessing summary for incomplete session', async ({ page }) => {
    // Mock session not completed
    await page.route('**/api/diagnostic/summary/**', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session not completed yet' })
      });
    });

    // Navigate to summary page for incomplete session
    await page.goto('/diagnostic/incomplete-session-123/summary');

    // Should show not completed error
    await expect(page.locator('h1')).toContainText('Diagnostic Not Completed');
    await expect(page.locator('text=been completed yet')).toBeVisible();
    
    // Should have button to continue diagnostic
    const continueButton = page.getByRole('button', { name: /continue diagnostic/i });
    await expect(continueButton).toBeVisible();
    
    // Button should navigate to diagnostic session page
    await continueButton.click();
    await helpers.waitForPageLoad('/diagnostic/incomplete-session-123');
  });

  test('should show access denied for unauthorized session access', async ({ page }) => {
    // Mock unauthorized access
    await page.route('**/api/diagnostic**', async route => {
      const url = route.request().url();
      if (url.includes('unauthorized-session')) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized to access this session.' })
        });
      }
    });

    // Navigate to unauthorized session
    await page.goto('/diagnostic/unauthorized-session/summary');

    // Should show access denied error
    await expect(page.locator('h1')).toContainText('Access Denied');
    await expect(page.locator('text=do not have permission')).toBeVisible();
    
    // Should have button to start new diagnostic
    const startNewButton = page.getByRole('button', { name: /start new diagnostic/i });
    await expect(startNewButton).toBeVisible();
  });

  test('should successfully access valid completed session summary', async ({ page }) => {
    // Navigate to valid summary URL
    await page.goto('/diagnostic/test-session-123/summary');

    // Should show summary page
    await summaryPage.expectSummaryPage();
    await summaryPage.expectScore(67);
    await summaryPage.expectCorrectAnswers(2, 3);
    await summaryPage.expectExamType('Google Professional ML Engineer');
  });

  test('should handle expired session gracefully', async ({ page }) => {
    // Mock expired session
    await page.route('**/api/diagnostic**', async route => {
      const url = route.request().url();
      if (url.includes('expired-session')) {
        await route.fulfill({
          status: 410,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session expired.' })
        });
      }
    });

    // Navigate to expired session
    await page.goto('/diagnostic/expired-session-456');

    // Should show session expired error
    await expect(page.locator('h1')).toContainText('Session Expired');
    await expect(page.locator('text=30 minutes of inactivity')).toBeVisible();
    
    // Should have button to start new diagnostic
    const startNewButton = page.getByRole('button', { name: /start new diagnostic/i });
    await expect(startNewButton).toBeVisible();
  });

  test('should redirect from session page to summary when session is completed', async ({ page }) => {
    // Mock completed session that redirects
    await page.route('**/api/diagnostic?sessionId=**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: 'completed-session-123',
            completed_at: new Date().toISOString(),
            examType: 'Google Professional ML Engineer',
            questions: [],
            startedAt: new Date().toISOString()
          }
        })
      });
    });

    // Navigate to completed session
    await page.goto('/diagnostic/completed-session-123');

    // Should automatically redirect to summary or show completed state
    // Implementation may vary - check for summary page or completion message
    await page.waitForTimeout(1000); // Give time for any redirects
    
    const currentUrl = page.url();
    const hasCompletedState = await page.locator('text=completed').count() > 0;
    const isSummaryPage = currentUrl.includes('/summary');
    
    expect(hasCompletedState || isSummaryPage).toBeTruthy();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('**/api/diagnostic**', async route => {
      await route.abort('failed');
    });

    // Navigate to session page
    await page.goto('/diagnostic/network-error-session');

    // Should show generic error page or handle gracefully
    await expect(page.locator('h1')).toContainText('Error');
  });

  test('should handle malformed session IDs', async ({ page }) => {
    const malformedIds = [
      'session-with-special-chars-@#$',
      'session%20with%20spaces',
      'session/with/slashes',
      'session<script>alert("xss")</script>',
      ''
    ];

    for (const sessionId of malformedIds) {
      // Mock error response for malformed IDs
      await page.route('**/api/diagnostic**', async route => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid session ID provided' })
        });
      });

      // Navigate to malformed session URL
      await page.goto(`/diagnostic/${encodeURIComponent(sessionId)}`);

      // Should handle gracefully (either error page or redirect)
      const hasErrorHeading = await page.locator('h1:has-text("Error")').count() > 0;
      const isRedirected = !page.url().includes(encodeURIComponent(sessionId));
      
      expect(hasErrorHeading || isRedirected).toBeTruthy();
    }
  });

  test('should preserve URL parameters during error scenarios', async ({ page }) => {
    // Mock session not found
    await page.route('**/api/diagnostic/session/*/status**', async route => {
      const url = route.request().url();
      // Check if anonymousSessionId parameter is preserved
      expect(url).toContain('anonymousSessionId=test-anon-123');
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: false, status: 'not_found' })
      });
    });

    // Set session in localStorage to trigger status check
    await helpers.setSessionInLocalStorage('not-found-session', 'test-anon-123');

    // Navigate to diagnostic page
    await startPage.goto();

    // Should clean up and not show resume prompt
    await startPage.expectResumePromptNotVisible();
  });

  test('should handle deep linking to specific question numbers', async ({ page }) => {
    // This tests that direct URL access doesn't break the application
    // Even though we don't implement question-specific URLs, the app should handle gracefully
    
    // Navigate to diagnostic session (which should start from beginning)
    await page.goto('/diagnostic/test-session-123');

    // Should start from question 1 regardless of any URL fragments or parameters
    await expect(page.locator('h1')).toContainText('Question 1 of');
  });
});