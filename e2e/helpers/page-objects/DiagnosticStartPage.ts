import { Page, Locator, expect } from '@playwright/test';

export class DiagnosticStartPage {
  readonly page: Page;
  readonly examTypeSelect: Locator;
  readonly questionCountInput: Locator;
  readonly startButton: Locator;
  readonly resumeSection: Locator;
  readonly resumeButton: Locator;
  readonly startOverButton: Locator;
  readonly resumeMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.examTypeSelect = page.locator('#examType');
    this.questionCountInput = page.locator('#numQuestions');
    this.startButton = page.getByRole('button', { name: /start diagnostic/i });
    this.resumeSection = page.locator('section:has-text("Unfinished Diagnostic Found")');
    this.resumeButton = page.getByRole('button', { name: /resume/i });
    this.startOverButton = page.getByRole('button', { name: /start over/i });
    this.resumeMessage = page.locator('text=You have an unfinished');
  }

  async goto() {
    await this.page.goto('/diagnostic');
    await this.page.waitForLoadState('domcontentloaded');
    // Try networkidle but don't fail if it takes too long
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 8000 });
    } catch (error) {
      // If networkidle times out, just continue - DOM should be ready
      console.log('NetworkIdle timeout, continuing with DOM checks...');
    }
    // Wait for the page to fully hydrate by checking for the form visibility
    await this.expectStartDiagnosticFormVisible();
  }

  async selectExamType(examType: string) {
    // Wait for the selector to be enabled (exam types loaded)
    await expect(this.examTypeSelect).toBeEnabled({ timeout: 20000 });
    await this.examTypeSelect.selectOption({ label: examType });
  }

  async setQuestionCount(count: number) {
    await this.questionCountInput.fill(count.toString());
  }

  async startDiagnostic() {
    await this.startButton.click();
  }

  async expectResumePromptVisible() {
    await expect(this.resumeSection).toBeVisible({ timeout: 10000 });
    await expect(this.resumeMessage).toBeVisible({ timeout: 10000 });
  }

  async expectResumePromptNotVisible() {
    await expect(this.resumeSection).not.toBeVisible();
  }

  async expectResumePromptContains(examType: string) {
    await expect(this.resumeMessage).toContainText(examType);
  }

  async clickResume() {
    await this.resumeButton.click();
  }

  async clickStartOver() {
    await this.startOverButton.click();
  }

  async expectStartDiagnosticFormVisible() {
    await expect(this.examTypeSelect).toBeVisible({ timeout: 15000 });
    await expect(this.questionCountInput).toBeVisible({ timeout: 15000 });
    await expect(this.startButton).toBeVisible({ timeout: 15000 });
  }

  async expectPageTitle() {
    await expect(this.page.locator('h1')).toContainText('Start Diagnostic');
  }

  async expectStartButtonEnabled() {
    await expect(this.startButton).toBeEnabled();
  }

  async expectStartButtonDisabled() {
    await expect(this.startButton).toBeDisabled();
  }
}