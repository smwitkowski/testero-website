import { test, expect } from '@playwright/test';
import { DiagnosticStartPage } from './helpers/page-objects/DiagnosticStartPage';
import { DiagnosticQuestionPage } from './helpers/page-objects/DiagnosticQuestionPage';
import { DiagnosticSummaryPage } from './helpers/page-objects/DiagnosticSummaryPage';
import { DiagnosticHelpers } from './helpers/diagnostic-helpers';

test.describe('Diagnostic Complete Flow', () => {
  let startPage: DiagnosticStartPage;
  let questionPage: DiagnosticQuestionPage;
  let summaryPage: DiagnosticSummaryPage;
  let helpers: DiagnosticHelpers;

  test.beforeEach(async ({ page }) => {
    startPage = new DiagnosticStartPage(page);
    questionPage = new DiagnosticQuestionPage(page);
    summaryPage = new DiagnosticSummaryPage(page);
    helpers = new DiagnosticHelpers(page);

    // Set up API mocks first
    await helpers.setupApiMocks();
    
    // Navigate to a page to enable localStorage access
    await page.goto('/');
    
    // Clear state
    await helpers.clearLocalStorage();
  });

  test('should complete full diagnostic flow from start to summary', async ({ page }) => {
    // Step 1: Start diagnostic
    await startPage.goto();
    await startPage.expectPageTitle();
    await startPage.expectStartDiagnosticFormVisible();

    // Step 2: Configure and start diagnostic
    await startPage.selectExamType('Google ML Engineer');
    await startPage.setQuestionCount(3);
    await startPage.expectStartButtonEnabled();
    
    // Wait for start diagnostic to complete and store session info
    await startPage.startDiagnostic();
    
    // Verify session is stored in localStorage
    await page.waitForFunction(() => {
      return localStorage.getItem('testero_diagnostic_session_id') === 'test-session-123';
    });

    // Step 3: Answer first question
    await helpers.waitForPageLoad('**/diagnostic/**');
    await questionPage.expectQuestionPage(1, 3);
    await questionPage.expectOptionsVisible();
    await questionPage.selectOption('B');
    await questionPage.expectSubmitButtonEnabled();
    await questionPage.submitAnswer();

    // Step 4: Verify feedback and continue
    await questionPage.expectFeedbackVisible();
    await questionPage.expectCorrectFeedback();
    await questionPage.expectExplanationVisible();
    await questionPage.expectNextButtonVisible();
    await questionPage.clickNext();

    // Step 5: Answer second question
    await questionPage.expectQuestionPage(2, 3);
    await questionPage.selectOption('A'); // Wrong answer
    await questionPage.submitAnswer();
    await questionPage.expectIncorrectFeedback();
    await questionPage.clickNext();

    // Step 6: Answer third question
    await questionPage.expectQuestionPage(3, 3);
    await questionPage.selectOption('B'); // Correct answer
    await questionPage.submitAnswer();
    await questionPage.expectCorrectFeedback();
    await questionPage.expectViewResultsButtonVisible();
    await questionPage.clickViewResults();

    // Step 7: Verify redirect to summary page
    await helpers.waitForPageLoad('**/summary');
    await summaryPage.expectSummaryPage();

    // Step 8: Verify summary content
    await summaryPage.expectScore(67);
    await summaryPage.expectCorrectAnswers(2, 3);
    await summaryPage.expectExamType('Google Professional ML Engineer');
    await summaryPage.expectQuestionDetailsVisible();
    await summaryPage.expectQuestionCount(3);

    // Step 9: Verify individual question results
    await summaryPage.expectQuestionResult(1, true);
    await summaryPage.expectQuestionResult(2, false);
    await summaryPage.expectQuestionResult(3, true);

    // Step 10: Verify action buttons
    await summaryPage.expectActionButtonsVisible();

    // Step 11: Verify localStorage cleanup
    const localStorageValues = await helpers.getLocalStorageValues();
    expect(localStorageValues.sessionId).toBeNull();
  });

  test('should handle answer selection and submission correctly', async ({ page }) => {
    await startPage.goto();
    await startPage.selectExamType('Google ML Engineer');
    await startPage.setQuestionCount(3);
    await startPage.startDiagnostic();

    await helpers.waitForPageLoad('**/diagnostic/**');

    // Test that submit button is disabled initially
    await questionPage.expectSubmitButtonDisabled();

    // Test selecting an option enables submit button
    await questionPage.selectOption('A');
    await questionPage.expectSelectedOption('A');
    await questionPage.expectSubmitButtonEnabled();

    // Test changing selection
    await questionPage.selectOption('B');
    await questionPage.expectSelectedOption('B');
    await questionPage.expectSubmitButtonEnabled();

    // Test submission
    await questionPage.submitAnswer();
    await questionPage.expectFeedbackVisible();
    
    // Test that options are disabled after submission
    await expect(questionPage.optionButtons.first()).toBeDisabled();
  });

  test('should display correct visual feedback for answers', async ({ page }) => {
    await startPage.goto();
    await startPage.selectExamType('Google ML Engineer');
    await startPage.startDiagnostic();

    await helpers.waitForPageLoad('**/diagnostic/**');

    // Select correct answer (B)
    await questionPage.selectOption('B');
    await questionPage.submitAnswer();

    // Verify correct answer highlighting
    await questionPage.expectCorrectFeedback();
    await questionPage.expectOptionHighlightedAsCorrect('B');
  });

  test('should navigate back to start page from summary', async ({ page }) => {
    // Complete a diagnostic first
    await startPage.goto();
    await startPage.selectExamType('Google ML Engineer');
    await startPage.startDiagnostic();

    // Answer all questions quickly
    for (let i = 1; i <= 3; i++) {
      await helpers.waitForPageLoad();
      await questionPage.selectOption('B');
      await questionPage.submitAnswer();
      
      if (i < 3) {
        await questionPage.clickNext();
      } else {
        await questionPage.clickViewResults();
      }
    }

    // Now on summary page
    await summaryPage.expectSummaryPage();
    
    // Click "Take Another Diagnostic"
    await summaryPage.clickTakeAnother();
    
    // Should be back on start page
    await helpers.waitForPageLoad('/diagnostic');
    await startPage.expectPageTitle();
    await startPage.expectStartDiagnosticFormVisible();
  });
});