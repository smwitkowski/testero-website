import { Page, Locator, expect } from '@playwright/test';

export class DiagnosticSummaryPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly overallScore: Locator;
  readonly correctAnswers: Locator;
  readonly examType: Locator;
  readonly domainBreakdown: Locator;
  readonly questionDetails: Locator;
  readonly takeAnotherButton: Locator;
  readonly studyPlanButton: Locator;
  readonly scorePercentage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1').filter({ hasText: /diagnostic results/i });
    this.overallScore = page.locator('text=Overall Score');
    this.correctAnswers = page.locator('text=Correct Answers');
    this.examType = page.locator('text=Exam Type');
    this.domainBreakdown = page.locator('h2').filter({ hasText: /score by domain/i });
    this.questionDetails = page.locator('h2').filter({ hasText: /question details/i });
    this.takeAnotherButton = page.getByRole('button', { name: /take another diagnostic/i });
    this.studyPlanButton = page.getByRole('button', { name: /start my study plan/i });
    this.scorePercentage = page.locator('div').filter({ hasText: /^\d+%$/ }).first();
  }

  async expectSummaryPage() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.overallScore).toBeVisible();
    await expect(this.correctAnswers).toBeVisible();
  }

  async expectScore(score: number) {
    await expect(this.scorePercentage).toContainText(`${score}%`);
  }

  async expectCorrectAnswers(correct: number, total: number) {
    const scoreText = `${correct}/${total}`;
    await expect(this.page.locator(`text=${scoreText}`).first()).toBeVisible();
  }

  async expectExamType(examType: string) {
    await expect(this.page.locator(`text=${examType}`).first()).toBeVisible();
  }

  async expectDomainBreakdownVisible() {
    await expect(this.domainBreakdown).toBeVisible();
  }

  async expectQuestionDetailsVisible() {
    await expect(this.questionDetails).toBeVisible();
  }

  async expectQuestionCount(count: number) {
    // Look for question headers as they appear in the actual DOM
    const questions = this.page.locator('span').filter({ hasText: /^question \d+$/i });
    await expect(questions).toHaveCount(count);
  }

  async expectQuestionResult(questionNumber: number, isCorrect: boolean) {
    const questionDiv = this.page.locator('div').filter({ 
      hasText: new RegExp(`Question ${questionNumber}`) 
    });
    
    if (isCorrect) {
      await expect(questionDiv.locator('text=CORRECT').first()).toBeVisible();
    } else {
      await expect(questionDiv.locator('text=INCORRECT').first()).toBeVisible();
    }
  }

  async expectActionButtonsVisible() {
    await expect(this.takeAnotherButton).toBeVisible();
    await expect(this.studyPlanButton).toBeVisible();
  }

  async clickTakeAnother() {
    await this.takeAnotherButton.click();
  }

  async clickStudyPlan() {
    await this.studyPlanButton.click();
  }

  async expectDomainScore(domain: string, correct: number, total: number) {
    const domainSection = this.page.locator('div').filter({ hasText: domain });
    await expect(domainSection).toBeVisible();
    await expect(domainSection.locator(`text=${correct}/${total}`)).toBeVisible();
  }

  async expectScoreColor(score: number) {
    let expectedColor: string;
    if (score >= 70) {
      expectedColor = 'rgb(34, 197, 94)'; // Green
    } else if (score >= 50) {
      expectedColor = 'rgb(245, 158, 11)'; // Orange  
    } else {
      expectedColor = 'rgb(239, 68, 68)'; // Red
    }
    
    await expect(this.scorePercentage).toHaveCSS('color', expectedColor);
  }

  async expectUserAnswer(questionNumber: number, answer: string) {
    const questionDiv = this.page.locator('div').filter({ 
      hasText: new RegExp(`Question ${questionNumber}`) 
    });
    
    await expect(questionDiv.locator(`text=Your Answer`)).toBeVisible();
  }

  async expectCorrectAnswer(questionNumber: number, answer: string) {
    const questionDiv = this.page.locator('div').filter({ 
      hasText: new RegExp(`Question ${questionNumber}`) 
    });
    
    await expect(questionDiv.locator(`text=✓ Correct`)).toBeVisible();
  }
}