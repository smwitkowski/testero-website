/**
 * E2E Tests: Complete Authentication Signup Flow
 * 
 * Tests the entire user signup journey from initial signup through
 * email verification to authenticated dashboard access.
 */

import { test, expect } from '@playwright/test';
import { AuthHelpers, AuthTestData } from './helpers/auth-helpers';

test.describe('Authentication Signup Flow', () => {
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    
    // Mock all auth-related APIs for consistent testing
    await authHelpers.mockSupabaseAuth();
    await authHelpers.mockInternalAPIs();
  });

  test('should complete full signup flow: signup → email verification → dashboard access', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    // Step 1: User visits signup page and creates account
    await authHelpers.signUp(email, password);

    // Verify we're on success state showing email check message
    await expect(page.getByText(/check your email/i)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Step 2: User clicks verification link from email (simulated)
    const verificationToken = AuthTestData.generateToken();
    await authHelpers.verifyEmail(verificationToken);

    // Step 3: Verify successful verification and redirect to dashboard
    await expect(page.getByText(/email verified successfully/i)).toBeVisible();
    
    // Should auto-redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await authHelpers.expectLoggedIn();
  });

  test('should handle signup form validation errors', async ({ page }) => {
    await page.goto('/signup');

    // Test empty form submission
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();

    // Test invalid email
    await page.getByPlaceholder(/email address/i).fill('invalid-email');
    await page.getByPlaceholder(/password/i).fill('short');
    await page.getByRole('button', { name: /sign up/i }).click();
    
    await expect(page.getByText(/must be a valid email address/i)).toBeVisible();
    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();
  });

  test('should show loading state during signup submission', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    await page.goto('/signup');
    
    // Fill form
    await page.getByPlaceholder(/email address/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);
    
    // Click submit and check loading state
    await page.getByRole('button', { name: /sign up/i }).click();
    
    // Should show loading spinner and disabled state
    await expect(page.getByText(/signing up/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /signing up/i })).toBeDisabled();
  });

  test('should handle signup API errors gracefully', async ({ page }) => {
    // Mock API error response
    await page.route('**/api/auth/signup', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Email already registered',
        }),
      });
    });

    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    await authHelpers.signUp(email, password);

    // Should show error message instead of success state
    await expect(page.getByText(/email already registered/i)).toBeVisible();
    await expect(page.getByText(/check your email/i)).not.toBeVisible();
  });

  test('should handle email verification errors', async ({ page }) => {
    // Mock verification error
    await page.route('**/auth/v1/verify', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid or expired verification token',
        }),
      });
    });

    const invalidToken = 'invalid-token';
    await authHelpers.verifyEmail(invalidToken);

    // Should show error message
    await expect(page.getByText(/invalid or expired verification token/i)).toBeVisible();
    
    // Should provide option to resend verification
    await expect(page.getByRole('button', { name: /resend verification email/i })).toBeVisible();
  });

  test('should allow resending verification email from verification page', async ({ page }) => {
    // Navigate to verification page with invalid token
    await page.goto('/verify-email?token=invalid-token');
    
    // Mock verification error first
    await page.route('**/auth/v1/verify', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid token',
        }),
      });
    });

    // Wait for error to display
    await expect(page.getByText(/invalid/i)).toBeVisible();
    
    // Click resend button
    await page.getByRole('button', { name: /resend verification email/i }).click();
    
    // Should show success message for resend
    await expect(page.getByText(/verification email sent/i)).toBeVisible();
  });

  test('should prevent multiple rapid signup submissions', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    await page.goto('/signup');
    
    // Fill form
    await page.getByPlaceholder(/email address/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);
    
    // Submit form multiple times rapidly
    const submitButton = page.getByRole('button', { name: /sign up/i });
    await submitButton.click();
    
    // Button should be disabled after first click
    await expect(submitButton).toBeDisabled();
    
    // Try to click again - should remain disabled
    await submitButton.click({ force: true });
    await expect(submitButton).toBeDisabled();
  });

  test('should redirect authenticated users away from signup page', async ({ page }) => {
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
          },
        }),
      });
    });

    // Navigate to signup page when already authenticated
    await page.goto('/signup');
    
    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await authHelpers.expectLoggedIn();
  });

  test('should maintain responsive design on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/signup');
    
    // Check that form is properly sized and accessible on mobile
    const form = page.locator('form');
    await expect(form).toBeVisible();
    
    // Form should not overflow viewport
    const formBoundingBox = await form.boundingBox();
    expect(formBoundingBox?.width).toBeLessThanOrEqual(375);
    
    // Input fields should be easily tappable (minimum 44px height)
    const emailInput = page.getByPlaceholder(/email address/i);
    const emailBoundingBox = await emailInput.boundingBox();
    expect(emailBoundingBox?.height).toBeGreaterThanOrEqual(44);
  });
});