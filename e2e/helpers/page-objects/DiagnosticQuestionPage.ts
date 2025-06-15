import { Page, Locator, expect } from '@playwright/test';

export class DiagnosticQuestionPage {
  readonly page: Page;
  readonly questionTitle: Locator;
  readonly questionStem: Locator;
  readonly optionButtons: Locator;
  readonly submitButton: Locator;
  readonly nextButton: Locator;
  readonly viewResultsButton: Locator;
  readonly feedbackSection: Locator;
  readonly correctFeedback: Locator;
  readonly incorrectFeedback: Locator;
  readonly explanation: Locator;

  constructor(page: Page) {
    this.page = page;
    this.questionTitle = page.locator('h1').filter({ hasText: /diagnostic question/i });
    // Look for the question stem div - it has fontSize: 20, fontWeight: 500 styling
    this.questionStem = page.locator('section > div').first();
    // Get option buttons - they are inside the section element
    // Using main > to avoid footer/header buttons
    this.optionButtons = page.locator('main section button:not(:has-text("Submit Answer"))');
    this.submitButton = page.getByRole('button', { name: /submit answer/i });
    this.nextButton = page.getByRole('button', { name: /next question/i });
    this.viewResultsButton = page.getByRole('button', { name: /view results/i });
    this.feedbackSection = page.locator('div').filter({ hasText: /correct|incorrect/i }).first();
    this.correctFeedback = page.locator('text=Correct!');
    this.incorrectFeedback = page.locator('text=Incorrect.');
    this.explanation = page.locator('div').filter({ hasText: /explanation/i }).first();
  }

  async expectQuestionPage(questionNumber: number, totalQuestions: number) {
    await expect(this.questionTitle).toContainText(`Question ${questionNumber} of ${totalQuestions}`);
    await expect(this.questionStem).toBeVisible();
  }

  async expectOptionsVisible() {
    // Wait for buttons to be fully loaded
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.optionButtons).toHaveCount(4, { timeout: 15000 });
    for (let i = 0; i < 4; i++) {
      await expect(this.optionButtons.nth(i)).toBeVisible({ timeout: 10000 });
    }
  }

  async selectOption(label: string) {
    // Map label to position (A=0, B=1, C=2, D=3)
    const labelToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const index = labelToIndex[label.toUpperCase()];
    if (index === undefined) {
      throw new Error(`Invalid option label: ${label}. Must be A, B, C, or D.`);
    }
    
    const option = this.optionButtons.nth(index);
    await expect(option).toBeVisible({ timeout: 10000 });
    await option.click();
  }

  async submitAnswer() {
    await this.submitButton.click();
  }

  async expectSubmitButtonEnabled() {
    await expect(this.submitButton).toBeEnabled();
  }

  async expectSubmitButtonDisabled() {
    await expect(this.submitButton).toBeDisabled();
  }

  async expectFeedbackVisible() {
    await expect(this.feedbackSection).toBeVisible();
  }

  async expectCorrectFeedback() {
    await expect(this.correctFeedback).toBeVisible();
  }

  async expectIncorrectFeedback() {
    await expect(this.incorrectFeedback).toBeVisible();
  }

  async expectExplanationVisible() {
    await expect(this.explanation).toBeVisible();
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async clickViewResults() {
    await this.viewResultsButton.click();
  }

  async expectNextButtonVisible() {
    await expect(this.nextButton).toBeVisible();
  }

  async expectViewResultsButtonVisible() {
    await expect(this.viewResultsButton).toBeVisible();
  }

  async expectSelectedOption(label: string) {
    const labelToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const index = labelToIndex[label.toUpperCase()];
    const option = this.optionButtons.nth(index);
    await expect(option).toHaveCSS('border', /2px solid/);
  }

  async expectOptionHighlightedAsCorrect(label: string) {
    const labelToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const index = labelToIndex[label.toUpperCase()];
    const option = this.optionButtons.nth(index);
    await expect(option).toHaveCSS('background-color', 'rgb(209, 250, 223)'); // Light green
  }

  async expectOptionHighlightedAsIncorrect(label: string) {
    const labelToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const index = labelToIndex[label.toUpperCase()];
    const option = this.optionButtons.nth(index);
    await expect(option).toHaveCSS('background-color', 'rgb(255, 224, 224)'); // Light red
  }
}