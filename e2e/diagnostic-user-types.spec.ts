import { test, expect } from '@playwright/test';
import { DiagnosticStartPage } from './helpers/page-objects/DiagnosticStartPage';
import { DiagnosticQuestionPage } from './helpers/page-objects/DiagnosticQuestionPage';
import { DiagnosticSummaryPage } from './helpers/page-objects/DiagnosticSummaryPage';
import { DiagnosticHelpers } from './helpers/diagnostic-helpers';

test.describe('Diagnostic User Types', () => {
  let startPage: DiagnosticStartPage;
  let questionPage: DiagnosticQuestionPage;
  let summaryPage: DiagnosticSummaryPage;
  let helpers: DiagnosticHelpers;

  test.beforeEach(async ({ page }) => {
    startPage = new DiagnosticStartPage(page);
    questionPage = new DiagnosticQuestionPage(page);
    summaryPage = new DiagnosticSummaryPage(page);
    helpers = new DiagnosticHelpers(page);

    await helpers.setupApiMocks();
    await helpers.clearLocalStorage();
  });

  test('should handle anonymous user diagnostic flow', async ({ page }) => {
    // Set up PostHog event tracking
    await page.addInitScript(() => {
      (window as any).__playwright_posthog_events = [];
      (window as any).posthog = {
        capture: (event: string, data: any) => {
          (window as any).__playwright_posthog_events.push({ event, data });
        }
      };
    });

    // Complete diagnostic as anonymous user
    await startPage.goto();
    await startPage.selectExamType('Google ML Engineer');
    await startPage.startDiagnostic();

    // Verify session and anonymous IDs are stored
    await helpers.waitForPageLoad('**/diagnostic/**');
    const localStorageAfterStart = await helpers.getLocalStorageValues();
    expect(localStorageAfterStart.sessionId).toBe('test-session-123');
    expect(localStorageAfterStart.anonymousSessionId).toBe('test-anon-456');

    // Complete the diagnostic
    for (let i = 1; i <= 3; i++) {
      await questionPage.selectOption('B');
      await questionPage.submitAnswer();
      
      if (i < 3) {
        await questionPage.clickNext();
      } else {
        await questionPage.clickViewResults();
      }
    }

    // Verify navigation to summary
    await helpers.waitForPageLoad('**/summary');
    await summaryPage.expectSummaryPage();

    // Verify localStorage cleanup after completion
    const localStorageAfterCompletion = await helpers.getLocalStorageValues();
    expect(localStorageAfterCompletion.sessionId).toBeNull();
    // Anonymous ID might be preserved for future sessions
  });

  test('should maintain anonymous session across page refreshes', async ({ page }) => {
    // Start diagnostic as anonymous user
    await startPage.goto();
    await startPage.startDiagnostic();

    // Get initial anonymous session ID
    await helpers.waitForPageLoad('**/diagnostic/**');
    const initialLocalStorage = await helpers.getLocalStorageValues();
    const initialAnonymousId = initialLocalStorage.anonymousSessionId;
    
    expect(initialAnonymousId).toBeTruthy();

    // Refresh the page
    await page.reload();

    // Go back to start page
    await startPage.goto();

    // Should show resume prompt with same anonymous session
    await startPage.expectResumePromptVisible();

    // Verify anonymous ID is preserved
    const localStorageAfterRefresh = await helpers.getLocalStorageValues();
    expect(localStorageAfterRefresh.anonymousSessionId).toBe(initialAnonymousId);
  });

  test('should handle anonymous user resume flow', async ({ page }) => {
    // Set up existing anonymous session
    const anonymousId = 'persistent-anon-789';
    await helpers.setSessionInLocalStorage('test-session-123', anonymousId);

    // Navigate to diagnostic page
    await startPage.goto();

    // Should show resume prompt
    await startPage.expectResumePromptVisible();

    // Resume session
    await startPage.clickResume();
    await helpers.waitForPageLoad('**/diagnostic/test-session-123');

    // Verify we're in the diagnostic
    await questionPage.expectQuestionPage(1, 3);

    // Verify anonymous ID is maintained
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.anonymousSessionId).toBe(anonymousId);
  });

  test('should track PostHog events for anonymous users', async ({ page }) => {
    // Set up PostHog event tracking
    await page.addInitScript(() => {
      (window as any).__playwright_posthog_events = [];
      (window as any).posthog = {
        capture: (event: string, data: any) => {
          (window as any).__playwright_posthog_events.push({ event, data });
        }
      };
    });

    // Set up existing session to trigger resume prompt
    await helpers.setSessionInLocalStorage('test-session-123', 'test-anon-456');

    // Navigate to diagnostic page
    await startPage.goto();

    // Should trigger resume shown event
    let events = await page.evaluate(() => (window as any).__playwright_posthog_events);
    const resumeShownEvent = events.find((e: any) => e.event === 'diagnostic_resume_shown');
    expect(resumeShownEvent).toBeTruthy();
    expect(resumeShownEvent.data.sessionId).toBe('test-session-123');

    // Click resume
    await startPage.clickResume();

    // Should trigger resume event
    events = await page.evaluate(() => (window as any).__playwright_posthog_events);
    const resumeEvent = events.find((e: any) => e.event === 'diagnostic_resumed');
    expect(resumeEvent).toBeTruthy();
    expect(resumeEvent.data.sessionId).toBe('test-session-123');
  });

  test('should generate new anonymous ID for each browser session', async ({ context }) => {
    // First browser session
    const page1 = await context.newPage();
    const helpers1 = new DiagnosticHelpers(page1);
    const startPage1 = new DiagnosticStartPage(page1);

    await helpers1.setupApiMocks();
    await helpers1.clearLocalStorage();
    await startPage1.goto();
    await startPage1.startDiagnostic();

    const localStorage1 = await helpers1.getLocalStorageValues();
    const anonymousId1 = localStorage1.anonymousSessionId;

    // Second browser session (new page simulates new browser session)
    const page2 = await context.newPage();
    const helpers2 = new DiagnosticHelpers(page2);
    const startPage2 = new DiagnosticStartPage(page2);

    await helpers2.setupApiMocks();
    await helpers2.clearLocalStorage();
    await startPage2.goto();
    await startPage2.startDiagnostic();

    const localStorage2 = await helpers2.getLocalStorageValues();
    const anonymousId2 = localStorage2.anonymousSessionId;

    // Should have different anonymous IDs
    expect(anonymousId1).toBeTruthy();
    expect(anonymousId2).toBeTruthy();
    expect(anonymousId1).not.toBe(anonymousId2);

    await page1.close();
    await page2.close();
  });

  test('should handle session ownership for anonymous users', async ({ page }) => {
    // Mock unauthorized access (wrong anonymous session ID)
    await page.route('**/api/diagnostic/session/*/status**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exists: true,
          status: 'unauthorized'
        })
      });
    });

    // Set up session with anonymous ID
    await helpers.setSessionInLocalStorage('unauthorized-session', 'wrong-anon-id');

    // Navigate to diagnostic page
    await startPage.goto();

    // Should not show resume prompt due to authorization failure
    await startPage.expectResumePromptNotVisible();

    // Should show normal start form
    await startPage.expectStartDiagnosticFormVisible();

    // Verify localStorage was cleaned up
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should handle anonymous session timeout', async ({ page }) => {
    // Mock expired session
    await page.route('**/api/diagnostic/session/*/status**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exists: true,
          status: 'expired'
        })
      });
    });

    // Set up expired session
    await helpers.setSessionInLocalStorage('expired-session', 'test-anon-123');

    // Navigate to diagnostic page
    await startPage.goto();

    // Should not show resume prompt
    await startPage.expectResumePromptNotVisible();

    // Should be able to start new diagnostic
    await startPage.expectStartDiagnosticFormVisible();
    await startPage.selectExamType('Google ML Engineer');
    await startPage.startDiagnostic();

    // Should get new session ID
    await helpers.waitForPageLoad('**/diagnostic/**');
    const newLocalStorage = await helpers.getLocalStorageValues();
    expect(newLocalStorage.sessionId).toBe('test-session-123'); // New session from mock
    expect(newLocalStorage.sessionId).not.toBe('expired-session');
  });

  test('should maintain anonymous state throughout diagnostic completion', async ({ page }) => {
    const anonymousId = 'test-anon-consistency';

    // Mock responses to include consistent anonymous ID
    await page.route('**/api/diagnostic', async route => {
      const request = route.request();
      const method = request.method();
      
      if (method === 'POST') {
        const postData = request.postDataJSON();
        
        if (postData.action === 'start') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              sessionId: 'test-session-123',
              questions: [],
              totalQuestions: 3,
              expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              anonymousSessionId: anonymousId
            })
          });
        } else if (postData.action === 'complete') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              totalQuestions: 3,
              correctAnswers: 2,
              score: 67,
              recommendations: [],
              examType: 'Google Professional ML Engineer'
            })
          });
        }
      }
    });

    // Start diagnostic
    await startPage.goto();
    await startPage.startDiagnostic();

    // Verify anonymous ID is set
    await helpers.waitForPageLoad('**/diagnostic/**');
    let localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.anonymousSessionId).toBe(anonymousId);

    // Navigate to summary (simulate completion)
    await page.goto('/diagnostic/test-session-123/summary');
    await summaryPage.expectSummaryPage();

    // Anonymous ID should still be available if needed for future sessions
    // (though session ID should be cleared)
    localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull(); // Cleared in summary page
  });
});