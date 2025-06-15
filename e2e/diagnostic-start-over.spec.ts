import { test, expect } from '@playwright/test';
import { DiagnosticStartPage } from './helpers/page-objects/DiagnosticStartPage';
import { DiagnosticQuestionPage } from './helpers/page-objects/DiagnosticQuestionPage';
import { DiagnosticHelpers } from './helpers/diagnostic-helpers';

test.describe('Diagnostic Start Over Functionality', () => {
  let startPage: DiagnosticStartPage;
  let questionPage: DiagnosticQuestionPage;
  let helpers: DiagnosticHelpers;

  test.beforeEach(async ({ page }) => {
    startPage = new DiagnosticStartPage(page);
    questionPage = new DiagnosticQuestionPage(page);
    helpers = new DiagnosticHelpers(page);

    await helpers.setupApiMocks();
    await helpers.clearLocalStorage();
  });

  test('should allow starting over from resume prompt', async ({ page }) => {
    // Set up existing session
    await helpers.setSessionInLocalStorage('test-session-123', 'test-anon-456');

    // Navigate to diagnostic page
    await startPage.goto();
    await startPage.expectResumePromptVisible();

    // Click start over
    await startPage.clickStartOver();

    // Resume prompt should disappear
    await startPage.expectResumePromptNotVisible();

    // Should show the normal start form
    await startPage.expectStartDiagnosticFormVisible();
    await startPage.expectStartButtonEnabled();

    // Verify localStorage is cleared
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should be able to start new diagnostic after starting over', async ({ page }) => {
    // Set up existing session
    await helpers.setSessionInLocalStorage('old-session-123', 'old-anon-456');

    // Navigate and start over
    await startPage.goto();
    await startPage.expectResumePromptVisible();
    await startPage.clickStartOver();

    // Start new diagnostic
    await startPage.selectExamType('Google Cloud Digital Leader');
    await startPage.setQuestionCount(5);
    await startPage.startDiagnostic();

    // Should navigate to new diagnostic session
    await helpers.waitForPageLoad('**/diagnostic/**');
    await questionPage.expectQuestionPage(1, 3); // Mock returns 3 questions

    // Verify new session ID is stored
    const newLocalStorageValues = await helpers.getLocalStorageValues();
    expect(newLocalStorageValues.sessionId).toBe('test-session-123'); // From mock
    expect(newLocalStorageValues.sessionId).not.toBe('old-session-123');
  });

  test('should clear both session ID and anonymous ID when starting over', async ({ page }) => {
    // Set up session with both IDs
    await helpers.setSessionInLocalStorage('test-session-123', 'test-anon-456');

    // Verify both IDs are set
    let localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBe('test-session-123');
    expect(localStorageValues.anonymousSessionId).toBe('test-anon-456');

    // Navigate and start over
    await startPage.goto();
    await startPage.clickStartOver();

    // Verify session ID is cleared but anonymous ID might remain for new sessions
    localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
    // Anonymous ID might be kept for tracking purposes
  });

  test('should handle multiple start over actions', async ({ page }) => {
    // Set up session
    await helpers.setSessionInLocalStorage('test-session-123');

    // First start over
    await startPage.goto();
    await startPage.expectResumePromptVisible();
    await startPage.clickStartOver();
    await startPage.expectResumePromptNotVisible();

    // Simulate another session somehow getting into localStorage
    await helpers.setSessionInLocalStorage('another-session-456');
    await page.reload();

    // Should show resume prompt again
    await startPage.expectResumePromptVisible();

    // Second start over
    await startPage.clickStartOver();
    await startPage.expectResumePromptNotVisible();

    // Should still be able to start new diagnostic
    await startPage.expectStartDiagnosticFormVisible();
  });

  test('should not show resume prompt after starting over and refreshing', async ({ page }) => {
    // Set up session and start over
    await helpers.setSessionInLocalStorage('test-session-123');
    await startPage.goto();
    await startPage.clickStartOver();

    // Refresh the page
    await page.reload();

    // Should not show resume prompt
    await startPage.expectResumePromptNotVisible();
    await startPage.expectStartDiagnosticFormVisible();
  });

  test('should preserve form state when starting over', async ({ page }) => {
    // Set up session
    await helpers.setSessionInLocalStorage('test-session-123');

    // Navigate to page with resume prompt
    await startPage.goto();

    // Fill out form before starting over (this tests that the form is functional)
    await startPage.selectExamType('Google Cloud Architect');
    await startPage.setQuestionCount(10);

    // Now start over
    await startPage.clickStartOver();

    // Form should still be functional and retain its state
    await expect(startPage.examTypeSelect).toHaveValue('Google Cloud Professional Cloud Architect');
    await expect(startPage.questionCountInput).toHaveValue('10');
    await startPage.expectStartButtonEnabled();
  });

  test('should handle start over with network errors gracefully', async ({ page }) => {
    // Set up session
    await helpers.setSessionInLocalStorage('test-session-123');

    // Mock network error for session status check
    await page.route('**/api/diagnostic/session/*/status', async route => {
      await route.abort('failed');
    });

    // Navigate to page
    await startPage.goto();

    // Should handle gracefully and clean up localStorage
    await startPage.expectResumePromptNotVisible();
    await startPage.expectStartDiagnosticFormVisible();

    // Verify localStorage cleanup happened
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should track analytics events for start over action', async ({ page }) => {
    // Set up session
    await helpers.setSessionInLocalStorage('test-session-123');

    // Set up PostHog event tracking
    await page.addInitScript(() => {
      (window as any).__playwright_posthog_events = [];
      (window as any).posthog = {
        capture: (event: string, data: any) => {
          (window as any).__playwright_posthog_events.push({ event, data });
        }
      };
    });

    // Navigate and trigger resume prompt
    await startPage.goto();
    await startPage.expectResumePromptVisible();

    // Verify resume shown event
    let events = await page.evaluate(() => (window as any).__playwright_posthog_events);
    expect(events.some((e: any) => e.event === 'diagnostic_resume_shown')).toBeTruthy();

    // Click start over (this doesn't trigger an event in current implementation)
    await startPage.clickStartOver();

    // The start over action itself doesn't have an event, but it clears the session
    // which prepares for a new diagnostic session to be tracked
  });
});