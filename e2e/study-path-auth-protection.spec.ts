/**
 * E2E Tests: Study Path Authentication & Preview
 *
 * Tests that study path shows preview for anonymous users
 * and full content for authenticated users.
 */

import { test, expect } from "@playwright/test";
import { AuthHelpers } from "./helpers/auth-helpers";

test.describe("Study Path Authentication", () => {
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    await authHelpers.mockSupabaseAuth();
    await authHelpers.mockInternalAPIs();

    // Mock study path API
    await page.route("**/api/study-path", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          paths: [
            { domain: "ML Development", score: 45, priority: "high" },
            { domain: "MLOps", score: 60, priority: "medium" },
            { domain: "Data Engineering", score: 75, priority: "low" },
          ],
        }),
      });
    });
  });

  test("should show preview with signup CTA for unauthenticated users", async ({ page }) => {
    // Ensure user is not authenticated
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      });
    });

    // Navigate to study path
    await page.goto("/study-path");

    // Should stay on study path (not redirect immediately)
    expect(page.url()).toContain("/study-path");

    // Should show preview content
    await expect(page.getByText(/personalized study path/i)).toBeVisible({ timeout: 10000 });

    // Should show signup CTA
    await expect(
      page
        .getByRole("button", { name: /sign up to see full path/i })
        .or(page.getByRole("link", { name: /sign up/i }))
    ).toBeVisible();

    // Should blur or limit detailed content
    const blurredContent = page.locator('[class*="blur"]').or(page.locator('[class*="locked"]'));
    await expect(blurredContent.first()).toBeVisible();
  });

  test("should show full study path for authenticated users", async ({ page }) => {
    // Mock authenticated user with early access
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "mock-user-id",
            email: "test@example.com",
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { is_early_access: true },
          },
        }),
      });
    });

    // Navigate to study path
    await page.goto("/study-path");

    // Should stay on study path
    expect(page.url()).toContain("/study-path");

    // Should NOT show signup CTA
    await expect(
      page
        .getByRole("button", { name: /sign up to see full path/i })
        .or(page.getByRole("link", { name: /sign up to unlock/i }))
    ).not.toBeVisible();

    // Should show full content without blur
    const blurredContent = page.locator('[class*="blur"]').or(page.locator('[class*="locked"]'));
    const count = await blurredContent.count();
    expect(count).toBe(0);

    // Should show interactive elements
    await expect(page.getByRole("button", { name: /start learning/i }).first()).toBeVisible();
  });

  test("should preserve diagnostic data through authentication flow", async ({ page }) => {
    // Start unauthenticated
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      });
    });

    // Set diagnostic data in sessionStorage
    await page.goto("/");
    await page.evaluate(() => {
      sessionStorage.setItem(
        "diagnosticData",
        JSON.stringify({
          score: 65,
          domains: [
            { domain: "ML Development", correct: 5, total: 10, percentage: 50 },
            { domain: "MLOps", correct: 7, total: 10, percentage: 70 },
          ],
        })
      );
    });

    // Navigate to study path
    await page.goto("/study-path");

    // Should see preview
    await expect(page.getByText(/personalized study path/i)).toBeVisible();

    // Click signup CTA
    const signupButton = page
      .getByRole("button", { name: /sign up/i })
      .or(page.getByRole("link", { name: /sign up/i }));
    await signupButton.first().click();

    // Should redirect to signup
    await page.waitForURL(/\/(signup|login)/);

    // Verify diagnostic data is still in storage
    const diagnosticData = await page.evaluate(() => {
      return sessionStorage.getItem("diagnosticData");
    });
    expect(diagnosticData).toBeTruthy();
    if (diagnosticData) {
      expect(JSON.parse(diagnosticData)).toHaveProperty("score", 65);
    }
  });

  test("should track preview view and conversion events", async ({ page }) => {
    // Track PostHog events
    const capturedEvents: any[] = [];
    await page.route("**/e/**", async (route) => {
      const postData = route.request().postData();
      if (postData) {
        try {
          const data = JSON.parse(postData);
          if (data.events) {
            capturedEvents.push(...data.events);
          }
        } catch (e) {
          // Ignore non-JSON data
        }
      }
      await route.fulfill({ status: 200 });
    });

    // Start unauthenticated
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      });
    });

    // Navigate to study path
    await page.goto("/study-path");

    // Wait for page to load
    await expect(page.getByText(/personalized study path/i)).toBeVisible();

    // Should track preview view
    const previewEvent = capturedEvents.find(
      (e) => e.event === "study_path_preview_shown" || e.event === "study_path_viewed"
    );
    expect(previewEvent).toBeDefined();

    // Click signup CTA
    const signupButton = page
      .getByRole("button", { name: /sign up/i })
      .or(page.getByRole("link", { name: /sign up/i }));
    await signupButton.first().click();

    // Should track conversion attempt
    const conversionEvent = capturedEvents.find(
      (e) => e.event === "study_path_signup_clicked" || e.event === "auth_required_conversion"
    );
    expect(conversionEvent).toBeDefined();
  });

  test("should handle transition from preview to full access", async ({ page }) => {
    let isAuthenticated = false;

    // Mock dynamic auth state
    await page.route("**/auth/v1/user", async (route) => {
      if (isAuthenticated) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: {
              id: "mock-user-id",
              email: "test@example.com",
              email_confirmed_at: new Date().toISOString(),
              user_metadata: { is_early_access: true },
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: null }),
        });
      }
    });

    // Start on study path unauthenticated
    await page.goto("/study-path");

    // Should see preview
    await expect(page.getByText(/sign up to see full path/i).first()).toBeVisible();

    // Simulate authentication
    isAuthenticated = true;

    // Refresh the page
    await page.reload();

    // Should now see full content
    await expect(page.getByText(/sign up to see full path/i)).not.toBeVisible();

    // Should show interactive elements
    await expect(page.getByRole("button", { name: /start learning/i }).first()).toBeVisible();
  });
});
