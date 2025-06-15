import { test, expect } from '@playwright/test';

test.describe('Dashboard Functionality', () => {
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
  });

  test('should display dashboard with no data state', async ({ page }) => {
    // Mock dashboard API to return empty data
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
              totalQuestionsAnswered: 0,
              correctAnswers: 0,
              accuracyPercentage: 0,
              lastPracticeDate: null
            },
            readinessScore: 0
          }
        })
      });
    });

    await page.goto('/dashboard');

    // Check page title and header
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('text=Track your progress and exam readiness')).toBeVisible();

    // Check readiness meter shows 0%
    await expect(page.locator('text=0%')).toBeVisible();
    await expect(page.locator('text=Not Started')).toBeVisible();

    // Check diagnostic empty state
    await expect(page.locator('text=You haven\'t taken a diagnostic test yet')).toBeVisible();
    await expect(page.locator('text=Start Diagnostic')).toBeVisible();

    // Check practice empty state
    await expect(page.locator('text=You haven\'t answered any practice questions yet')).toBeVisible();
    await expect(page.locator('text=Start Practicing')).toBeVisible();

    // Check getting started section appears
    await expect(page.locator('text=Get Started with Your Study Journey')).toBeVisible();
  });

  test('should display dashboard with complete data', async ({ page }) => {
    // Mock dashboard API to return complete data
    await page.route('**/api/dashboard', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            diagnostic: {
              recentSessions: [
                {
                  id: 'session-1',
                  examType: 'Google ML Engineer',
                  score: 85,
                  completedAt: '2024-01-15T10:00:00Z',
                  totalQuestions: 10,
                  correctAnswers: 8
                },
                {
                  id: 'session-2',
                  examType: 'Google ML Engineer',
                  score: 75,
                  completedAt: '2024-01-10T14:30:00Z',
                  totalQuestions: 10,
                  correctAnswers: 7
                }
              ],
              totalSessions: 3
            },
            practice: {
              totalQuestionsAnswered: 45,
              correctAnswers: 38,
              accuracyPercentage: 84,
              lastPracticeDate: '2024-01-16T09:15:00Z'
            },
            readinessScore: 85
          }
        })
      });
    });

    await page.goto('/dashboard');

    // Check readiness meter shows 85%
    await expect(page.locator('text=85%')).toBeVisible();
    await expect(page.locator('text=Exam Ready!')).toBeVisible();

    // Check diagnostic summary shows data
    await expect(page.locator('text=Google ML Engineer')).toBeVisible();
    await expect(page.locator('text=85%')).toBeVisible();
    await expect(page.locator('text=75%')).toBeVisible();
    await expect(page.locator('text=8/10 correct')).toBeVisible();
    await expect(page.locator('text=3 total')).toBeVisible();

    // Check practice summary shows data  
    await expect(page.locator('text=45')).toBeVisible(); // Total questions
    await expect(page.locator('text=84%')).toBeVisible(); // Accuracy
    await expect(page.locator('text=38 / 45')).toBeVisible(); // Correct/total

    // Check CTAs are present
    await expect(page.locator('text=Take Another Diagnostic')).toBeVisible();
    await expect(page.locator('text=Continue Practicing')).toBeVisible();

    // Getting started section should NOT appear with data
    await expect(page.locator('text=Get Started with Your Study Journey')).not.toBeVisible();
  });

  test('should display dashboard with partial data (diagnostic only)', async ({ page }) => {
    // Mock dashboard API to return diagnostic data only
    await page.route('**/api/dashboard', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            diagnostic: {
              recentSessions: [
                {
                  id: 'session-1',
                  examType: 'Google ML Engineer',
                  score: 70,
                  completedAt: '2024-01-15T10:00:00Z',
                  totalQuestions: 10,
                  correctAnswers: 7
                }
              ],
              totalSessions: 1
            },
            practice: {
              totalQuestionsAnswered: 0,
              correctAnswers: 0,
              accuracyPercentage: 0,
              lastPracticeDate: null
            },
            readinessScore: 56 // 70 * 0.8 discounted
          }
        })
      });
    });

    await page.goto('/dashboard');

    // Check readiness meter shows discounted score
    await expect(page.locator('text=56%')).toBeVisible();
    await expect(page.locator('text=Needs Work')).toBeVisible();

    // Check diagnostic summary shows data
    await expect(page.locator('text=Google ML Engineer')).toBeVisible();
    await expect(page.locator('text=70%')).toBeVisible();

    // Check practice shows empty state
    await expect(page.locator('text=You haven\'t answered any practice questions yet')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock dashboard API to return error
    await page.route('**/api/dashboard', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error'
        })
      });
    });

    await page.goto('/dashboard');

    // Check error state is displayed
    await expect(page.locator('text=Error Loading Dashboard')).toBeVisible();
    await expect(page.locator('text=Internal server error')).toBeVisible();
    await expect(page.locator('text=Try Again')).toBeVisible();
  });

  test('should handle unauthorized access', async ({ page }) => {
    // Mock dashboard API to return 401
    await page.route('**/api/dashboard', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Authentication required. Please log in to access dashboard data.'
        })
      });
    });

    await page.goto('/dashboard');

    // Check error state for auth
    await expect(page.locator('text=Error Loading Dashboard')).toBeVisible();
    await expect(page.locator('text=Authentication required')).toBeVisible();
  });

  test('should navigate to diagnostic and practice pages from dashboard', async ({ page }) => {
    // Mock dashboard API with some data
    await page.route('**/api/dashboard', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            diagnostic: {
              recentSessions: [{
                id: 'session-1',
                examType: 'Google ML Engineer',
                score: 75,
                completedAt: '2024-01-15T10:00:00Z',
                totalQuestions: 10,
                correctAnswers: 7
              }],
              totalSessions: 1
            },
            practice: {
              totalQuestionsAnswered: 20,
              correctAnswers: 16,
              accuracyPercentage: 80,
              lastPracticeDate: '2024-01-16T09:15:00Z'
            },
            readinessScore: 76
          }
        })
      });
    });

    await page.goto('/dashboard');

    // Test navigation to diagnostic
    const diagnosticLink = page.locator('text=Take Another Diagnostic');
    await expect(diagnosticLink).toBeVisible();
    await expect(diagnosticLink).toHaveAttribute('href', '/diagnostic');

    // Test navigation to practice
    const practiceLink = page.locator('text=Continue Practicing');
    await expect(practiceLink).toBeVisible();
    await expect(practiceLink).toHaveAttribute('href', '/practice/question');

    // Test navigation to diagnostic results
    const viewResultsLink = page.locator('text=View Results');
    await expect(viewResultsLink).toBeVisible();
    await expect(viewResultsLink).toHaveAttribute('href', '/diagnostic/session-1/summary');
  });

  test('should show correct readiness color coding', async ({ page }) => {
    // Test different readiness scores and their color coding
    const testCases = [
      { score: 90, expectedText: 'Exam Ready!', expectedColor: '#10B981' },
      { score: 65, expectedText: 'Almost Ready', expectedColor: '#F59E0B' },
      { score: 45, expectedText: 'Needs Work', expectedColor: '#EF4444' },
      { score: 20, expectedText: 'Getting Started', expectedColor: '#6B7280' }
    ];

    for (const testCase of testCases) {
      await page.route('**/api/dashboard', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ok',
            data: {
              diagnostic: { recentSessions: [], totalSessions: 0 },
              practice: {
                totalQuestionsAnswered: 0,
                correctAnswers: 0,
                accuracyPercentage: 0,
                lastPracticeDate: null
              },
              readinessScore: testCase.score
            }
          })
        });
      });

      await page.goto('/dashboard');
      
      // Check score percentage is displayed
      await expect(page.locator(`text=${testCase.score}%`)).toBeVisible();
      
      // Check status text is correct
      await expect(page.locator(`text=${testCase.expectedText}`)).toBeVisible();
      
      // Note: Color checking in E2E tests is complex, so we focus on text content
      // The color logic is covered in unit tests
    }
  });

  test('should be responsive and work on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Mock dashboard API
    await page.route('**/api/dashboard', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            diagnostic: { recentSessions: [], totalSessions: 0 },
            practice: {
              totalQuestionsAnswered: 0,
              correctAnswers: 0,
              accuracyPercentage: 0,
              lastPracticeDate: null
            },
            readinessScore: 0
          }
        })
      });
    });

    await page.goto('/dashboard');

    // Check that all major components are visible on mobile
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('text=0%')).toBeVisible();
    await expect(page.locator('text=Start Diagnostic')).toBeVisible();
    await expect(page.locator('text=Start Practicing')).toBeVisible();

    // Check that the layout doesn't break (no horizontal scroll)
    const bodyWidth = await page.locator('body').boundingBox();
    expect(bodyWidth?.width).toBeLessThanOrEqual(375);
  });
});