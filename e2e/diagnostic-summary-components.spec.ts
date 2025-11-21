import { test, expect } from "@playwright/test";
import { DiagnosticHelpers } from "./helpers/diagnostic-helpers";

test.describe("Diagnostic Summary Page Components", () => {
  let diagnosticHelpers: DiagnosticHelpers;

  test.beforeEach(async ({ page }) => {
    diagnosticHelpers = new DiagnosticHelpers(page);
    await diagnosticHelpers.setupApiMocks();
  });

  test("should display all new components on summary page", async ({ page }) => {
    // Mock a completed diagnostic session
    const sessionId = "test-session-123";

    // Mock the summary API response
    await page.route(`/api/diagnostic/summary/${sessionId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: {
            sessionId: sessionId,
            examType: "Google ML Engineer",
            totalQuestions: 10,
            correctAnswers: 7,
            score: 70,
            startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            completedAt: new Date().toISOString(),
            questions: [
              {
                id: "1",
                stem: "What is the primary purpose of a neural network?",
                userAnswer: "A",
                correctAnswer: "A",
                isCorrect: true,
                options: [
                  { label: "A", text: "To mimic human brain pattern recognition" },
                  { label: "B", text: "To store data" },
                  { label: "C", text: "To perform calculations" },
                  { label: "D", text: "To replace algorithms" },
                ],
                explanation: "Neural networks are designed to mimic the structure and function of the human brain, processing information through interconnected nodes (neurons) to recognize patterns and make decisions.",
              },
              {
                id: "2",
                stem: "Which is a supervised learning algorithm?",
                userAnswer: "B",
                correctAnswer: "C",
                isCorrect: false,
                options: [
                  { label: "A", text: "K-means" },
                  { label: "B", text: "PCA" },
                  { label: "C", text: "Linear regression" },
                  { label: "D", text: "DBSCAN" },
                ],
                explanation: "Linear regression is a supervised learning algorithm because it learns from labeled training data (input-output pairs) to predict continuous values. K-means, PCA, and DBSCAN are unsupervised algorithms.",
              },
            ],
          },
          domainBreakdown: [
            { domain: "Neural Networks", correct: 2, total: 3, percentage: 67 },
            { domain: "Machine Learning Basics", correct: 3, total: 4, percentage: 75 },
            { domain: "Model Optimization", correct: 2, total: 3, percentage: 67 },
          ],
        }),
      });
    });

    // Navigate to the summary page
    await page.goto(`/diagnostic/${sessionId}/summary`);

    // Check for the main heading
    await expect(page.getByRole("heading", { name: "Diagnostic Results" })).toBeVisible();

    // Check for ScoreChart component
    const scoreChart = page.locator('[data-testid="score-chart"]');
    await expect(scoreChart).toBeVisible();
    await expect(page.getByText("70%")).toBeVisible();

    // Check for Overview section
    await expect(page.getByText("7/10")).toBeVisible();

    // Check for DomainBreakdown component
    await expect(page.getByText("Score by Domain")).toBeVisible();

    // Check for StudyRecommendations component
    await expect(page.getByText("Study Recommendations")).toBeVisible();

    // Check for QuestionReview component
    await expect(page.getByText("Question Details")).toBeVisible();

    // Check individual questions exist
    await expect(page.getByTestId("question-1")).toBeVisible();
    await expect(page.getByTestId("question-2")).toBeVisible();

    // Check for action buttons
    await expect(page.getByRole("button", { name: "Take Another Diagnostic" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start My Study Plan" })).toBeVisible();
  });

  test("should display explanations when questions are expanded", async ({ page }) => {
    const sessionId = "test-session-explanations";

    // Mock the summary API response with explanations
    await page.route(`/api/diagnostic/summary/${sessionId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: {
            sessionId: sessionId,
            examType: "Google ML Engineer",
            totalQuestions: 1,
            correctAnswers: 1,
            score: 100,
            startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            completedAt: new Date().toISOString(),
            questions: [
              {
                id: "1",
                stem: "What is the primary purpose of feature engineering?",
                userAnswer: "B",
                correctAnswer: "B",
                isCorrect: true,
                options: [
                  { label: "A", text: "To reduce dataset size" },
                  { label: "B", text: "To transform raw data into meaningful features" },
                  { label: "C", text: "To visualize data patterns" },
                  { label: "D", text: "To store data in databases" },
                ],
                explanation: "Feature engineering transforms raw data into meaningful features that ML algorithms can use effectively. This process directly impacts model accuracy by creating informative input signals.",
              },
            ],
          },
          domainBreakdown: [],
        }),
      });
    });

    // Navigate to the summary page
    await page.goto(`/diagnostic/${sessionId}/summary`);

    // Find and click the "View explanation" button for the question
    const viewExplanationButton = page.getByRole("button", { name: /view explanation/i }).first();
    await expect(viewExplanationButton).toBeVisible();
    await viewExplanationButton.click();

    // Verify the explanation text is visible
    await expect(
      page.getByText(
        "Feature engineering transforms raw data into meaningful features that ML algorithms can use effectively. This process directly impacts model accuracy by creating informative input signals."
      )
    ).toBeVisible();

    // Verify the explanation heading is present
    await expect(page.getByText("Explanation:")).toBeVisible();
  });

  test("should not show explanation section when explanation is missing", async ({ page }) => {
    const sessionId = "test-session-no-explanation";

    // Mock the summary API response without explanations
    await page.route(`/api/diagnostic/summary/${sessionId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: {
            sessionId: sessionId,
            examType: "Google ML Engineer",
            totalQuestions: 1,
            correctAnswers: 1,
            score: 100,
            startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            completedAt: new Date().toISOString(),
            questions: [
              {
                id: "1",
                stem: "What is the primary purpose of feature engineering?",
                userAnswer: "B",
                correctAnswer: "B",
                isCorrect: true,
                options: [
                  { label: "A", text: "To reduce dataset size" },
                  { label: "B", text: "To transform raw data into meaningful features" },
                  { label: "C", text: "To visualize data patterns" },
                  { label: "D", text: "To store data in databases" },
                ],
                // No explanation field
              },
            ],
          },
          domainBreakdown: [],
        }),
      });
    });

    // Navigate to the summary page
    await page.goto(`/diagnostic/${sessionId}/summary`);

    // Expand the question
    const viewExplanationButton = page.getByRole("button", { name: /view explanation/i }).first();
    await expect(viewExplanationButton).toBeVisible();
    await viewExplanationButton.click();

    // Verify the explanation heading is NOT present (since explanation is missing)
    await expect(page.getByText("Explanation:")).not.toBeVisible();
  });

  test("should handle expand/collapse in question review", async ({ page }) => {
    const sessionId = "test-session-expand";

    // Mock with a long question
    await page.route(`/api/diagnostic/summary/${sessionId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: {
            sessionId: sessionId,
            examType: "Google ML Engineer",
            totalQuestions: 1,
            correctAnswers: 0,
            score: 0,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            questions: [
              {
                id: "1",
                stem:
                  "This is a very long question that contains a lot of text to test the expand/collapse functionality. " +
                  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
                  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
                userAnswer: "A",
                correctAnswer: "B",
                isCorrect: false,
                options: [
                  {
                    label: "A",
                    text: "Option A with long text that might need wrapping on smaller screens and should trigger expand button",
                  },
                  { label: "B", text: "Option B is the correct answer" },
                  { label: "C", text: "Option C is another choice" },
                  { label: "D", text: "Option D is the final option" },
                ],
              },
            ],
          },
          domainBreakdown: [],
        }),
      });
    });

    await page.goto(`/diagnostic/${sessionId}/summary`);

    // Check for expand button
    const expandButton = page.getByRole("button", { name: /show more/i });
    await expect(expandButton).toBeVisible();

    // Click to expand
    await expandButton.click();

    // Button text should change
    await expect(page.getByRole("button", { name: /show less/i })).toBeVisible();
  });

  test("should show low score performance indicators", async ({ page }) => {
    const sessionId = "test-session-low-score";

    await page.route(`/api/diagnostic/summary/${sessionId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: {
            sessionId: sessionId,
            examType: "Google ML Engineer",
            totalQuestions: 10,
            correctAnswers: 3,
            score: 30,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            questions: [],
          },
          domainBreakdown: [{ domain: "Test Domain", correct: 1, total: 5, percentage: 20 }],
        }),
      });
    });

    await page.goto(`/diagnostic/${sessionId}/summary`);

    // Check for low score indicators
    await expect(page.getByText("30%")).toBeVisible();
    await expect(page.getByText("Foundation Building")).toBeVisible();

    // Check that components rendered properly
    await expect(page.getByText("Study Recommendations")).toBeVisible();
    await expect(page.getByText("Score by Domain")).toBeVisible();
  });
});
