/**
 * E2E Tests: Password Reset Flow
 * 
 * Tests the complete password reset workflow from request through
 * email verification to password update and login.
 */

import { test, expect } from '@playwright/test';
import { AuthHelpers, AuthTestData } from './helpers/auth-helpers';

test.describe('Password Reset Flow', () => {
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    await authHelpers.mockSupabaseAuth();
    await authHelpers.mockInternalAPIs();
  });

  test('should complete full password reset flow', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const newPassword = AuthTestData.generatePassword();

    // Step 1: Request password reset
    await authHelpers.requestPasswordReset(email);

    // Should show success message
    await expect(page.getByText(/check your email/i)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Step 2: Click reset link from email (simulated)
    const resetToken = AuthTestData.generateToken();
    await authHelpers.resetPassword(resetToken, newPassword);

    // Step 3: Should show success and redirect to login
    await expect(page.getByText(/password updated successfully/i)).toBeVisible();
    await page.waitForURL('/login');

    // Step 4: Login with new password
    await authHelpers.logIn(email, newPassword);
    
    // Should successfully login
    await page.waitForURL('/dashboard');
    await authHelpers.expectLoggedIn();
  });

  test('should validate forgot password form', async ({ page }) => {
    await page.goto('/forgot-password');

    // Test empty form submission
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText(/email is required/i)).toBeVisible();

    // Test invalid email format
    await page.getByPlaceholder(/email address/i).fill('invalid-email');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText(/must be a valid email address/i)).toBeVisible();
  });

  test('should validate reset password form', async ({ page }) => {
    const resetToken = AuthTestData.generateToken();
    await page.goto(`/reset-password?token=${resetToken}`);

    // Test empty form submission
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/password is required/i)).toBeVisible();

    // Test short password
    await page.getByPlaceholder(/new password/i).fill('short');
    await page.getByPlaceholder(/confirm password/i).fill('short');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();

    // Test password mismatch
    await page.getByPlaceholder(/new password/i).fill('password123');
    await page.getByPlaceholder(/confirm password/i).fill('different123');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should handle invalid or expired reset tokens', async ({ page }) => {
    // Mock token verification error
    await page.route('**/auth/v1/verify', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid or expired reset token',
        }),
      });
    });

    const invalidToken = 'invalid-token';
    await page.goto(`/reset-password?token=${invalidToken}`);

    // Should show error message
    await expect(page.getByText(/invalid or expired reset token/i)).toBeVisible();
    
    // Should provide link to request new reset
    await expect(page.getByRole('link', { name: /request new reset link/i })).toBeVisible();
  });

  test('should handle forgot password API errors', async ({ page }) => {
    // Mock API error
    await page.route('**/api/auth/password-reset', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Email not found',
        }),
      });
    });

    const email = 'nonexistent@example.com';
    await authHelpers.requestPasswordReset(email);

    // Should show error message
    await expect(page.getByText(/email not found/i)).toBeVisible();
  });

  test('should handle reset password API errors', async ({ page }) => {
    // Mock password update error
    await page.route('**/auth/v1/user', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to update password',
          }),
        });
      } else {
        await route.continue();
      }
    });

    const resetToken = AuthTestData.generateToken();
    const newPassword = AuthTestData.generatePassword();
    
    await authHelpers.resetPassword(resetToken, newPassword);

    // Should show error message
    await expect(page.getByText(/failed to update password/i)).toBeVisible();
  });

  test('should show loading states during reset flow', async ({ page }) => {
    // Test loading state during forgot password request
    await page.goto('/forgot-password');
    const email = AuthTestData.generateEmail();
    
    await page.getByPlaceholder(/email address/i).fill(email);
    await page.getByRole('button', { name: /send reset link/i }).click();
    
    // Should show loading state
    await expect(page.getByText(/sending/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sending/i })).toBeDisabled();

    // Test loading state during password reset
    const resetToken = AuthTestData.generateToken();
    await page.goto(`/reset-password?token=${resetToken}`);
    
    const newPassword = AuthTestData.generatePassword();
    await page.getByPlaceholder(/new password/i).fill(newPassword);
    await page.getByPlaceholder(/confirm password/i).fill(newPassword);
    await page.getByRole('button', { name: /update password/i }).click();
    
    // Should show loading state
    await expect(page.getByText(/updating/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /updating/i })).toBeDisabled();
  });

  test('should handle rate limiting on forgot password requests', async ({ page }) => {
    // Mock rate limiting
    await page.route('**/api/auth/password-reset', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Too many reset requests. Please wait before trying again.',
        }),
      });
    });

    const email = AuthTestData.generateEmail();
    await authHelpers.requestPasswordReset(email);

    // Should show rate limiting message
    await expect(page.getByText(/too many reset requests/i)).toBeVisible();
  });

  test('should navigate between forgot password and login pages', async ({ page }) => {
    // From login to forgot password
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot password/i }).click();
    
    await page.waitForURL('/forgot-password');
    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();

    // From forgot password back to login
    await page.getByRole('link', { name: /back to sign in/i }).click();
    
    await page.waitForURL('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should redirect authenticated users away from reset pages', async ({ page }) => {
    // Mock authenticated session
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'authenticated@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { is_early_access: true },
          },
        }),
      });
    });

    // Try to access forgot password page when authenticated
    await page.goto('/forgot-password');
    await page.waitForURL('/dashboard');
    
    // Try to access reset password page when authenticated
    const resetToken = AuthTestData.generateToken();
    await page.goto(`/reset-password?token=${resetToken}`);
    await page.waitForURL('/dashboard');
  });

  test('should handle missing reset token', async ({ page }) => {
    // Navigate to reset password page without token
    await page.goto('/reset-password');

    // Should show error about missing token
    await expect(page.getByText(/invalid reset link/i)).toBeVisible();
    
    // Should provide link to request new reset
    await expect(page.getByRole('link', { name: /request new reset link/i })).toBeVisible();
  });

  test('should track password reset analytics', async ({ page }) => {
    // Mock PostHog analytics
    const analyticsEvents: any[] = [];
    await page.addInitScript(() => {
      (window as any).posthog = {
        capture: (event: string, properties: any) => {
          (window as any)._analyticsEvents = (window as any)._analyticsEvents || [];
          (window as any)._analyticsEvents.push({ event, properties });
        }
      };
    });

    const email = AuthTestData.generateEmail();
    await authHelpers.requestPasswordReset(email);

    // Check analytics events
    const events = await page.evaluate(() => (window as any)._analyticsEvents || []);
    
    const resetRequest = events.find((e: any) => e.event === 'password_reset_request');
    expect(resetRequest).toBeTruthy();
    expect(resetRequest.properties.email).toBe(email);
  });

  test('should maintain responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test forgot password page
    await page.goto('/forgot-password');
    
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    const formBoundingBox = await form.boundingBox();
    expect(formBoundingBox?.width).toBeLessThanOrEqual(375);

    // Test reset password page
    const resetToken = AuthTestData.generateToken();
    await page.goto(`/reset-password?token=${resetToken}`);
    
    const resetForm = page.locator('form');
    await expect(resetForm).toBeVisible();
    
    const resetFormBoundingBox = await resetForm.boundingBox();
    expect(resetFormBoundingBox?.width).toBeLessThanOrEqual(375);
  });

  test('should handle concurrent reset requests', async ({ page, context }) => {
    const email = AuthTestData.generateEmail();
    
    // Open second page
    const page2 = await context.newPage();
    const authHelpers2 = new AuthHelpers(page2);
    await authHelpers2.mockSupabaseAuth();
    await authHelpers2.mockInternalAPIs();
    
    // Request password reset from both pages
    const request1Promise = authHelpers.requestPasswordReset(email);
    const request2Promise = authHelpers2.requestPasswordReset(email);
    
    // Both should handle gracefully
    await Promise.all([request1Promise, request2Promise]);
    
    await expect(page.getByText(/check your email/i)).toBeVisible();
    await expect(page2.getByText(/check your email/i)).toBeVisible();
    
    await page2.close();
  });
});