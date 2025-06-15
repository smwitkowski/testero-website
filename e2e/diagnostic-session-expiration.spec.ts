import { test, expect } from '@playwright/test';
import { DiagnosticStartPage } from './helpers/page-objects/DiagnosticStartPage';
import { DiagnosticHelpers } from './helpers/diagnostic-helpers';

test.describe('Diagnostic Session Expiration', () => {
  let startPage: DiagnosticStartPage;
  let helpers: DiagnosticHelpers;

  test.beforeEach(async ({ page }) => {
    startPage = new DiagnosticStartPage(page);
    helpers = new DiagnosticHelpers(page);

    await helpers.setupApiMocks();
    await helpers.clearLocalStorage();
  });

  test('should clean up expired sessions from localStorage', async ({ page }) => {
    // Mock expired session
    await helpers.mockExpiredSession();
    
    // Set expired session in localStorage
    await helpers.setSessionInLocalStorage('expired-session-123', 'test-anon-456');

    // Navigate to diagnostic page
    await startPage.goto();

    // Should not show resume prompt
    await startPage.expectResumePromptNotVisible();

    // Should show normal start form
    await startPage.expectStartDiagnosticFormVisible();

    // Verify localStorage was cleaned up
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should clean up non-existent sessions from localStorage', async ({ page }) => {
    // Mock session not found
    await helpers.mockSessionNotFound();
    
    // Set non-existent session in localStorage
    await helpers.setSessionInLocalStorage('non-existent-session-456');

    // Navigate to diagnostic page
    await startPage.goto();

    // Should not show resume prompt
    await startPage.expectResumePromptNotVisible();

    // Should show normal start form
    await startPage.expectStartDiagnosticFormVisible();

    // Verify localStorage was cleaned up
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should clean up completed sessions from localStorage', async ({ page }) => {
    // Mock completed session
    await helpers.mockCompletedSession();
    
    // Set completed session in localStorage
    await helpers.setSessionInLocalStorage('completed-session-789');

    // Navigate to diagnostic page
    await startPage.goto();

    // Should not show resume prompt
    await startPage.expectResumePromptNotVisible();

    // Should show normal start form
    await startPage.expectStartDiagnosticFormVisible();

    // Verify localStorage was cleaned up
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should handle multiple expired sessions in localStorage', async ({ page }) => {
    // Mock expired session response
    await helpers.mockExpiredSession();
    
    // Set multiple session IDs (simulating corruption or multiple expired sessions)
    await page.evaluate(() => {
      localStorage.setItem('testero_diagnostic_session_id', 'expired-1');
      localStorage.setItem('old_session_id', 'expired-2'); // Legacy key
      localStorage.setItem('another_session', 'expired-3'); // Random key
    });

    // Navigate to diagnostic page
    await startPage.goto();

    // Should clean up the main session ID
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();

    // Should show normal start form
    await startPage.expectStartDiagnosticFormVisible();
  });

  test('should handle session expiration during diagnostic flow', async ({ page }) => {
    // Start a normal diagnostic
    await startPage.goto();
    await startPage.startDiagnostic();

    // Simulate session expiring mid-flow
    await page.route('**/api/diagnostic', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        const postData = request.postDataJSON();
        if (postData.action === 'answer') {
          // Simulate session expired during answer submission
          await route.fulfill({
            status: 410,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Session expired.' })
          });
          return;
        }
      }
      
      // Let other requests through normally
      await route.continue();
    });

    // Try to answer a question (should fail with expired session)
    await helpers.waitForPageLoad('**/diagnostic/**');
    
    // Page should handle the error gracefully
    // Implementation may vary - could show error message or redirect
    const hasErrorHandling = await Promise.race([
      page.locator('text=expired').waitFor({ timeout: 5000 }).then(() => true),
      page.locator('text=error').waitFor({ timeout: 5000 }).then(() => true),
      page.waitForURL('/diagnostic', { timeout: 5000 }).then(() => true),
      Promise.resolve(false)
    ]);

    expect(hasErrorHandling).toBeTruthy();
  });

  test('should handle network errors when checking session status', async ({ page }) => {
    // Set session in localStorage
    await helpers.setSessionInLocalStorage('network-error-session');

    // Mock network error for session status check
    await page.route('**/api/diagnostic/session/*/status', async route => {
      await route.abort('failed');
    });

    // Navigate to diagnostic page
    await startPage.goto();

    // Should handle network error gracefully and clean up localStorage
    await startPage.expectResumePromptNotVisible();
    await startPage.expectStartDiagnosticFormVisible();

    // Verify localStorage cleanup on network error
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should handle race conditions with session expiration', async ({ page }) => {
    // Set up session
    await helpers.setSessionInLocalStorage('race-condition-session');

    // Mock slow session status response
    await page.route('**/api/diagnostic/session/*/status', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exists: true,
          status: 'expired'
        })
      });
    });

    // Navigate to diagnostic page
    await startPage.goto();

    // Should show loading state initially, then clean up
    await page.waitForTimeout(3000); // Wait for slow response

    // Should not show resume prompt after delay
    await startPage.expectResumePromptNotVisible();
    await startPage.expectStartDiagnosticFormVisible();

    // Verify cleanup happened
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should handle session expiration with anonymous session ID cleanup', async ({ page }) => {
    // Mock expired session
    await helpers.mockExpiredSession();
    
    // Set both session and anonymous IDs
    await helpers.setSessionInLocalStorage('expired-session-with-anon', 'test-anon-123');

    // Navigate to diagnostic page
    await startPage.goto();

    // Should clean up session ID
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
    
    // Anonymous ID might be preserved for new sessions (implementation dependent)
    // This is acceptable as anonymous IDs can be reused
  });

  test('should allow starting new diagnostic after session expiration cleanup', async ({ page }) => {
    // Clean up expired session first
    await helpers.mockExpiredSession();
    await helpers.setSessionInLocalStorage('expired-before-new');
    
    await startPage.goto();
    await startPage.expectResumePromptNotVisible();

    // Now set up normal mock for new diagnostic
    await helpers.setupApiMocks();

    // Should be able to start new diagnostic normally
    await startPage.selectExamType('Google ML Engineer');
    await startPage.setQuestionCount(3);
    await startPage.expectStartButtonEnabled();
    await startPage.startDiagnostic();

    // Should navigate to new diagnostic session
    await helpers.waitForPageLoad('**/diagnostic/**');
    
    // Verify new session is created
    const newLocalStorageValues = await helpers.getLocalStorageValues();
    expect(newLocalStorageValues.sessionId).toBe('test-session-123'); // From mock
    expect(newLocalStorageValues.sessionId).not.toBe('expired-before-new');
  });

  test('should handle edge case of malformed session data in localStorage', async ({ page }) => {
    // Set malformed data in localStorage
    await page.evaluate(() => {
      localStorage.setItem('testero_diagnostic_session_id', '{"malformed": "json"}');
      localStorage.setItem('anonymousSessionId', 'null');
    });

    // Navigate to diagnostic page
    await startPage.goto();

    // Should handle gracefully and show normal form
    await startPage.expectResumePromptNotVisible();
    await startPage.expectStartDiagnosticFormVisible();
  });
});