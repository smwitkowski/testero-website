/**
 * E2E Tests: Practice Question Authentication Protection
 *
 * Tests that practice questions require authentication and properly
 * redirect unauthenticated users to login.
 */

import { test, expect } from "@playwright/test";
import { AuthHelpers } from "./helpers/auth-helpers";

test.describe("Practice Question Authentication", () => {
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    await authHelpers.mockSupabaseAuth();
    await authHelpers.mockInternalAPIs();
  });

  test("should redirect unauthenticated users from practice question page to login", async ({
    page,
  }) => {
    // Ensure user is not authenticated
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      });
    });

    // Try to access practice question page
    await page.goto("/practice/question");

    // Should redirect to login
    await page.waitForURL("/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("should redirect unauthenticated users from specific practice question to login", async ({
    page,
  }) => {
    // Ensure user is not authenticated
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      });
    });

    // Try to access specific practice question
    await page.goto("/practice/question/test-123");

    // Should redirect to login
    await page.waitForURL("/login", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });

  test("should allow authenticated users to access practice questions", async ({ page }) => {
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

    // Mock question API response
    await page.route("**/api/questions/current", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "q1",
          question_text: "Test question",
          options: [
            { key: "A", text: "Option A" },
            { key: "B", text: "Option B" },
          ],
        }),
      });
    });

    // Access practice question page as authenticated user
    await page.goto("/practice/question");

    // Should stay on practice page (not redirect)
    expect(page.url()).toContain("/practice/question");

    // Should show question content
    await expect(page.getByText("Test question")).toBeVisible({ timeout: 10000 });
  });

  test("should track auth required event when blocking access", async ({ page }) => {
    // Ensure user is not authenticated
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null }),
      });
    });

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

    // Try to access practice question
    await page.goto("/practice/question");

    // Should redirect to login
    await page.waitForURL("/login", { timeout: 10000 });

    // Should have tracked the auth required event
    const authRequiredEvent = capturedEvents.find(
      (e) => e.event === "practice_access_blocked" || e.event === "auth_required"
    );
    expect(authRequiredEvent).toBeDefined();
  });

  test("should preserve intended destination after login", async ({ page }) => {
    // Start unauthenticated
    await page.route("**/auth/v1/user", async (route, request) => {
      const url = new URL(request.url());
      // First call returns no user
      if (!url.searchParams.has("authenticated")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user: null }),
        });
      } else {
        // After "login" return authenticated user
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
      }
    });

    // Try to access practice question
    await page.goto("/practice/question/specific-123");

    // Should redirect to login
    await page.waitForURL("/login", { timeout: 10000 });

    // Verify redirect parameter is set
    const url = new URL(page.url());
    expect(url.searchParams.get("redirect") || url.searchParams.get("next")).toBeTruthy();
  });
});
