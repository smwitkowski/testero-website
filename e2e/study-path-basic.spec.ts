import { test, expect } from "@playwright/test";

test.describe("Study Path Basic - TDD GREEN Phase", () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase getSession to return no session (public access)
    await page.route("**/auth/v1/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: null,
          refresh_token: null,
          expires_at: null,
          user: null,
        }),
      });
    });
  });

  test("should display study path page with basic content", async ({ page }) => {
    // Navigate directly to study path page
    await page.goto("/study-path");

    // Check that the page loads and displays the expected heading
    await expect(
      page.getByRole("heading", { name: /your personalized study path/i })
    ).toBeVisible();

    // Check that the basic content is displayed
    await expect(page.getByText(/complete a diagnostic test/i)).toBeVisible();
  });

  test("should display diagnostic data when available in sessionStorage", async ({ page }) => {
    // Navigate to study path page
    await page.goto("/study-path");

    // Set up diagnostic data in sessionStorage
    await page.evaluate(() => {
      const diagnosticData = {
        score: 40,
        domains: [
          { domain: "Neural Networks", correct: 1, total: 3, percentage: 33 },
          { domain: "Machine Learning Basics", correct: 2, total: 4, percentage: 50 },
        ],
      };
      sessionStorage.setItem("diagnosticData", JSON.stringify(diagnosticData));
    });

    // Reload page to pick up sessionStorage data
    await page.reload();

    // Check that diagnostic data is displayed
    await expect(page.getByText("40%")).toBeVisible();
    await expect(page.getByText("Neural Networks")).toBeVisible();
    await expect(page.getByText("Foundation Building")).toBeVisible(); // Score-based messaging
  });
});
