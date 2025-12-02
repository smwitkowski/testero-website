import { test, expect } from '@playwright/test';

test.describe('Dashboard Readiness Summary', () => {
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

    // Mock the main dashboard API (for diagnostic/practice lists)
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
  });

  test('should display readiness summary with completed PMLE diagnostic', async ({ page }) => {
    const sessionId = 'session-pmle-123';
    const completedAt = '2024-01-15T10:00:00Z';
    const score = 80;

    // Mock the readiness summary API
    await page.route('**/api/dashboard/summary?examKey=pmle', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            examKey: 'pmle',
            currentReadinessScore: score,
            currentReadinessTier: {
              id: 'ready',
              label: 'Ready',
              description: 'Approaching exam readiness. Keep practicing to maintain and strengthen your knowledge.'
            },
            lastDiagnosticDate: completedAt,
            lastDiagnosticSessionId: sessionId,
            totalDiagnosticsCompleted: 1,
            hasCompletedDiagnostic: true
          }
        })
      });
    });

    await page.goto('/dashboard');

    // Check that the readiness score is displayed
    await expect(page.locator('text=80%')).toBeVisible();

    // Check that the tier label is displayed
    await expect(page.locator('text=Ready')).toBeVisible();

    // Check that the explanatory text is displayed
    await expect(page.locator('text=Based on your latest diagnostic')).toBeVisible();

    // Check that the date is formatted and displayed
    await expect(page.locator('text=/Jan 15, 2024/')).toBeVisible();

    // Check that the "View results" link is present and points to the correct URL
    const viewResultsLink = page.locator('text=View results');
    await expect(viewResultsLink).toBeVisible();
    await expect(viewResultsLink).toHaveAttribute('href', `/diagnostic/${sessionId}/summary`);
  });

  test('should display empty state when no PMLE diagnostics exist', async ({ page }) => {
    // Mock the readiness summary API to return empty state
    await page.route('**/api/dashboard/summary?examKey=pmle', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            examKey: 'pmle',
            currentReadinessScore: 0,
            currentReadinessTier: null,
            lastDiagnosticDate: null,
            lastDiagnosticSessionId: null,
            totalDiagnosticsCompleted: 0,
            hasCompletedDiagnostic: false
          }
        })
      });
    });

    await page.goto('/dashboard');

    // Check that 0% is displayed
    await expect(page.locator('text=0%').first()).toBeVisible();

    // Check that "Get started" label is displayed
    await expect(page.locator('text=Get started')).toBeVisible();

    // Check that empty state description is displayed
    await expect(page.locator('text=/Take your first PMLE diagnostic to see your readiness score/')).toBeVisible();

    // Check that CTA button is displayed
    const ctaButton = page.locator('text=Take your first diagnostic');
    await expect(ctaButton).toBeVisible();

    // Mock the diagnostic session creation API
    await page.route('**/api/diagnostic/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'new-session-123'
        })
      });
    });

    // Click the CTA button and verify navigation
    await ctaButton.click();
    
    // Verify navigation to diagnostic page
    await expect(page).toHaveURL(/\/diagnostic\/new-session-123/);
  });

  test('should handle readiness summary API error gracefully', async ({ page }) => {
    // Mock the readiness summary API to return an error
    await page.route('**/api/dashboard/summary?examKey=pmle', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error'
        })
      });
    });

    await page.goto('/dashboard');

    // Dashboard should still load (graceful degradation)
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Should show empty state (0%) as fallback
    await expect(page.locator('text=0%').first()).toBeVisible();
    await expect(page.locator('text=Get started')).toBeVisible();
  });

  test('should display correct tier for different score ranges', async ({ page }) => {
    const testCases = [
      { score: 30, tierLabel: 'Low' },
      { score: 50, tierLabel: 'Building' },
      { score: 75, tierLabel: 'Ready' },
      { score: 90, tierLabel: 'Strong' },
    ];

    for (const testCase of testCases) {
      // Mock the readiness summary API with different scores
      await page.route('**/api/dashboard/summary?examKey=pmle', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ok',
            data: {
              examKey: 'pmle',
              currentReadinessScore: testCase.score,
              currentReadinessTier: {
                id: testCase.tierLabel.toLowerCase(),
                label: testCase.tierLabel,
                description: `Test description for ${testCase.tierLabel}`
              },
              lastDiagnosticDate: '2024-01-15T10:00:00Z',
              lastDiagnosticSessionId: 'session-123',
              totalDiagnosticsCompleted: 1,
              hasCompletedDiagnostic: true
            }
          })
        });
      });

      await page.goto('/dashboard');

      // Check that the score is displayed
      await expect(page.locator(`text=${testCase.score}%`)).toBeVisible();

      // Check that the tier label is displayed
      await expect(page.locator(`text=${testCase.tierLabel}`)).toBeVisible();

      // Reload to reset for next test case
      await page.reload();
    }
  });

  test('should navigate to diagnostic summary when clicking View results', async ({ page }) => {
    const sessionId = 'session-pmle-456';
    const completedAt = '2024-01-20T14:30:00Z';

    // Mock the readiness summary API
    await page.route('**/api/dashboard/summary?examKey=pmle', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            examKey: 'pmle',
            currentReadinessScore: 85,
            currentReadinessTier: {
              id: 'strong',
              label: 'Strong',
              description: 'Well-prepared for the exam.'
            },
            lastDiagnosticDate: completedAt,
            lastDiagnosticSessionId: sessionId,
            totalDiagnosticsCompleted: 2,
            hasCompletedDiagnostic: true
          }
        })
      });
    });

    // Mock the diagnostic summary page
    await page.route(`**/api/diagnostic/summary/${sessionId}**`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: {
            sessionId,
            examType: 'Google ML Engineer',
            totalQuestions: 10,
            correctAnswers: 8,
            score: 85,
            startedAt: '2024-01-20T14:00:00Z',
            completedAt,
            questions: []
          },
          domainBreakdown: []
        })
      });
    });

    await page.goto('/dashboard');

    // Click the "View results" link
    const viewResultsLink = page.locator('text=View results');
    await expect(viewResultsLink).toBeVisible();
    await viewResultsLink.click();

    // Verify navigation to diagnostic summary page
    await expect(page).toHaveURL(`/diagnostic/${sessionId}/summary`);
  });

  test('should not display View results link when sessionId is missing', async ({ page }) => {
    // Mock the readiness summary API without sessionId
    await page.route('**/api/dashboard/summary?examKey=pmle', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          data: {
            examKey: 'pmle',
            currentReadinessScore: 80,
            currentReadinessTier: {
              id: 'ready',
              label: 'Ready',
              description: 'Approaching exam readiness.'
            },
            lastDiagnosticDate: '2024-01-15T10:00:00Z',
            lastDiagnosticSessionId: null,
            totalDiagnosticsCompleted: 1,
            hasCompletedDiagnostic: true
          }
        })
      });
    });

    await page.goto('/dashboard');

    // Check that explanatory text is still displayed
    await expect(page.locator('text=Based on your latest diagnostic')).toBeVisible();

    // Check that "View results" link is NOT displayed
    await expect(page.locator('text=View results')).not.toBeVisible();
  });
});


