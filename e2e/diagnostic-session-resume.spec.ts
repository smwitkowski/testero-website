import { test, expect } from '@playwright/test';
import { DiagnosticStartPage } from './helpers/page-objects/DiagnosticStartPage';
import { DiagnosticQuestionPage } from './helpers/page-objects/DiagnosticQuestionPage';
import { DiagnosticHelpers } from './helpers/diagnostic-helpers';

test.describe('Diagnostic Session Resume', () => {
  let startPage: DiagnosticStartPage;
  let questionPage: DiagnosticQuestionPage;
  let helpers: DiagnosticHelpers;

  test.beforeEach(async ({ page }) => {
    startPage = new DiagnosticStartPage(page);
    questionPage = new DiagnosticQuestionPage(page);
    helpers = new DiagnosticHelpers(page);

    // Set up API mocks first
    await helpers.setupApiMocks();
    
    // Navigate to a page to enable localStorage access
    await page.goto('/');
    
    // Clear state
    await helpers.clearLocalStorage();
  });

  test('should show resume prompt when returning to diagnostic page with active session', async ({ page }) => {
    // Step 1: Simulate having an active session in localStorage
    await helpers.setSessionInLocalStorage('test-session-123', 'test-anon-456');

    // Step 2: Navigate to diagnostic page
    await startPage.goto();

    // Step 3: Verify resume prompt appears
    await startPage.expectResumePromptVisible();
    await startPage.expectResumePromptContains('Google Professional ML Engineer');

    // Step 4: Verify both resume and start over buttons are present
    await expect(startPage.resumeButton).toBeVisible();
    await expect(startPage.startOverButton).toBeVisible();
  });

  test('should resume diagnostic session when clicking resume button', async ({ page }) => {
    // Set up existing session
    await helpers.setSessionInLocalStorage('test-session-123', 'test-anon-456');

    // Navigate to diagnostic page
    await startPage.goto();
    await startPage.expectResumePromptVisible();

    // Click resume button
    await startPage.clickResume();

    // Should navigate to the diagnostic session page
    await helpers.waitForPageLoad('**/diagnostic/test-session-123');
    await questionPage.expectQuestionPage(1, 3);
  });

  test('should clear session and allow new diagnostic when clicking start over', async ({ page }) => {
    // Set up existing session
    await helpers.setSessionInLocalStorage('test-session-123', 'test-anon-456');

    // Navigate to diagnostic page
    await startPage.goto();
    await startPage.expectResumePromptVisible();

    // Click start over button
    await startPage.clickStartOver();

    // Resume prompt should disappear
    await startPage.expectResumePromptNotVisible();

    // Should be able to start new diagnostic
    await startPage.expectStartDiagnosticFormVisible();
    await startPage.selectExamType('Google ML Engineer');
    await startPage.expectStartButtonEnabled();

    // Verify localStorage was cleared
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should not show resume prompt when no session exists', async ({ page }) => {
    // Navigate to diagnostic page with clean localStorage
    await startPage.goto();

    // No resume prompt should appear
    await startPage.expectResumePromptNotVisible();
    await startPage.expectStartDiagnosticFormVisible();
  });

  test('should not show resume prompt for expired session', async ({ page }) => {
    // Set up expired session mock
    await helpers.mockExpiredSession();
    await helpers.setSessionInLocalStorage('expired-session-123');

    // Navigate to diagnostic page
    await startPage.goto();

    // No resume prompt should appear
    await startPage.expectResumePromptNotVisible();
    await startPage.expectStartDiagnosticFormVisible();

    // Verify localStorage was cleaned up
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should not show resume prompt for completed session', async ({ page }) => {
    // Set up completed session mock
    await helpers.mockCompletedSession();
    await helpers.setSessionInLocalStorage('completed-session-123');

    // Navigate to diagnostic page
    await startPage.goto();

    // No resume prompt should appear
    await startPage.expectResumePromptNotVisible();
    await startPage.expectStartDiagnosticFormVisible();

    // Verify localStorage was cleaned up
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should not show resume prompt for non-existent session', async ({ page }) => {
    // Set up session not found mock
    await helpers.mockSessionNotFound();
    await helpers.setSessionInLocalStorage('non-existent-session-123');

    // Navigate to diagnostic page
    await startPage.goto();

    // No resume prompt should appear
    await startPage.expectResumePromptNotVisible();
    await startPage.expectStartDiagnosticFormVisible();

    // Verify localStorage was cleaned up
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should handle page refresh during diagnostic session', async ({ page }) => {
    // Start a new diagnostic
    await startPage.goto();
    await startPage.selectExamType('Google ML Engineer');
    await startPage.startDiagnostic();

    // Answer first question to simulate partial completion
    await helpers.waitForPageLoad('**/diagnostic/**');
    await questionPage.selectOption('B');
    await questionPage.submitAnswer();
    await questionPage.clickNext();

    // Verify session is stored in localStorage
    const localStorageBeforeRefresh = await helpers.getLocalStorageValues();
    expect(localStorageBeforeRefresh.sessionId).toBe('test-session-123');

    // Refresh the page
    await page.reload();

    // Navigate back to diagnostic start page
    await startPage.goto();

    // Should see resume prompt
    await startPage.expectResumePromptVisible();

    // Resume should work
    await startPage.clickResume();
    await helpers.waitForPageLoad('**/diagnostic/test-session-123');
    await questionPage.expectQuestionPage(1, 3); // Mocked to always start at question 1
  });

  test('should maintain anonymous session ID across browser sessions', async ({ page }) => {
    const anonymousId = 'persistent-anon-123';
    
    // Set up session with anonymous ID
    await helpers.setSessionInLocalStorage('test-session-123', anonymousId);

    // Navigate to diagnostic page
    await startPage.goto();
    await startPage.expectResumePromptVisible();

    // Verify anonymous session ID is maintained
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.anonymousSessionId).toBe(anonymousId);

    // Resume session
    await startPage.clickResume();
    await helpers.waitForPageLoad('**/diagnostic/test-session-123');

    // Verify anonymous ID is still present
    const localStorageAfterResume = await helpers.getLocalStorageValues();
    expect(localStorageAfterResume.anonymousSessionId).toBe(anonymousId);
  });
});