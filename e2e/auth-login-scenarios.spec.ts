/**
 * E2E Tests: Login Error Scenarios and Unconfirmed Email Handling
 * 
 * Tests various login scenarios including invalid credentials, unconfirmed
 * email warnings, resend confirmation functionality, and error handling.
 */

import { test, expect } from '@playwright/test';
import { AuthHelpers, AuthTestData } from './helpers/auth-helpers';

test.describe('Login Error Scenarios and Email Confirmation', () => {
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    await authHelpers.mockSupabaseAuth();
    await authHelpers.mockInternalAPIs();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Mock login failure
    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid login credentials',
        }),
      });
    });

    const email = AuthTestData.generateEmail();
    const password = 'wrongpassword';

    await authHelpers.logIn(email, password);

    // Should show error message
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
    
    // Should remain on login page
    expect(page.url()).toContain('/login');
    await authHelpers.expectLoggedOut();
  });

  test('should show unconfirmed email warning and resend option', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    // Mock login with unconfirmed email
    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Email not confirmed',
        }),
      });
    });

    await authHelpers.logIn(email, password);

    // Should show unconfirmed email warning
    await authHelpers.expectUnconfirmedEmailWarning();
    
    // Should show resend button
    await expect(page.getByRole('button', { name: /resend confirmation/i })).toBeVisible();
  });

  test('should handle resend confirmation from login page', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    // Mock unconfirmed email login
    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Email not confirmed',
        }),
      });
    });

    await authHelpers.logIn(email, password);
    await authHelpers.expectUnconfirmedEmailWarning();

    // Click resend confirmation
    await authHelpers.clickResendConfirmation();

    // Should show success message
    await expect(page.getByText(/confirmation email sent/i)).toBeVisible();
    
    // Should show rate limiting message if clicked again quickly
    await authHelpers.clickResendConfirmation();
    await expect(page.getByText(/please wait/i)).toBeVisible();
  });

  test('should handle successful login with confirmed email', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    // Mock successful login
    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: email,
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { is_early_access: true },
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
          },
        }),
      });
    });

    await authHelpers.logIn(email, password);

    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await authHelpers.expectLoggedIn();
  });

  test('should show loading state during login attempt', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    await page.goto('/login');
    
    // Fill form
    await page.getByPlaceholder(/email address/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);
    
    // Click submit and check loading state
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show loading state
    await expect(page.getByText(/signing in/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  test('should validate form fields before submission', async ({ page }) => {
    await page.goto('/login');

    // Test empty form submission
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();

    // Test invalid email format
    await page.getByPlaceholder(/email address/i).fill('invalid-email');
    await page.getByPlaceholder(/password/i).fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await expect(page.getByText(/must be a valid email address/i)).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/auth/v1/token', async (route) => {
      await route.abort('failed');
    });

    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    await authHelpers.logIn(email, password);

    // Should show network error message
    await expect(page.getByText(/network error|something went wrong/i)).toBeVisible();
  });

  test('should redirect authenticated users away from login page', async ({ page }) => {
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

    // Navigate to login page when already authenticated
    await page.goto('/login');
    
    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await authHelpers.expectLoggedIn();
  });

  test('should handle rate limiting on resend confirmation', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    // Mock unconfirmed email login
    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Email not confirmed',
        }),
      });
    });

    await authHelpers.logIn(email, password);
    await authHelpers.expectUnconfirmedEmailWarning();

    // Mock rate limiting on resend
    await page.route('**/api/auth/resend-confirmation', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Too many requests. Please wait before trying again.',
        }),
      });
    });

    // Click resend confirmation
    await authHelpers.clickResendConfirmation();

    // Should show rate limiting message
    await expect(page.getByText(/too many requests/i)).toBeVisible();
  });

  test('should track login analytics events', async ({ page }) => {
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
    const password = AuthTestData.generatePassword();

    // Test failed login analytics
    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid credentials',
        }),
      });
    });

    await authHelpers.logIn(email, password);

    // Check analytics events
    const events = await page.evaluate(() => (window as any)._analyticsEvents || []);
    
    const loginAttempt = events.find((e: any) => e.event === 'login_attempt');
    expect(loginAttempt).toBeTruthy();
    
    const loginError = events.find((e: any) => e.event === 'login_error');
    expect(loginError).toBeTruthy();
    expect(loginError.properties.error).toContain('Invalid credentials');
  });

  test('should handle email confirmation after successful resend', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    // Mock unconfirmed email login first
    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Email not confirmed',
        }),
      });
    });

    await authHelpers.logIn(email, password);
    await authHelpers.expectUnconfirmedEmailWarning();

    // Resend confirmation
    await authHelpers.clickResendConfirmation();
    await expect(page.getByText(/confirmation email sent/i)).toBeVisible();

    // Now mock email verification
    const verificationToken = AuthTestData.generateToken();
    await authHelpers.verifyEmail(verificationToken);

    // Should show verification success
    await expect(page.getByText(/email verified successfully/i)).toBeVisible();
    
    // Should redirect to dashboard
    await page.waitForURL('/dashboard');
    await authHelpers.expectLoggedIn();
  });

  test('should maintain form state during error scenarios', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    // Mock login failure
    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid credentials',
        }),
      });
    });

    await authHelpers.logIn(email, password);

    // After error, email should still be filled but password should be cleared
    const emailInput = page.getByPlaceholder(/email address/i);
    const passwordInput = page.getByPlaceholder(/password/i);
    
    await expect(emailInput).toHaveValue(email);
    await expect(passwordInput).toHaveValue('');
  });

  test('should handle login with users lacking early access', async ({ page }) => {
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    // Mock successful login but without early access
    await page.route('**/auth/v1/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: email,
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { is_early_access: false },
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
          },
        }),
      });
    });

    await authHelpers.logIn(email, password);

    // Should redirect to early access coming soon page
    await page.waitForURL('/early-access-coming-soon');
    expect(page.url()).toContain('/early-access-coming-soon');
  });
});