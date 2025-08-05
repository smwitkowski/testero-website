/**
 * E2E Tests: Comprehensive Authentication Flows
 * 
 * This test suite provides comprehensive end-to-end testing of all authentication flows
 * including signup, login, password reset, email verification, error recovery,
 * rate limiting, and cross-browser compatibility. This consolidates and extends
 * the individual auth test files to ensure complete coverage of the authentication system.
 */

import { test, expect } from '@playwright/test';
import { AuthHelpers, AuthTestData } from './helpers/auth-helpers';

test.describe('Comprehensive Authentication Flows', () => {
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    await authHelpers.mockSupabaseAuth();
    await authHelpers.mockInternalAPIs();
  });

  test.describe('Complete User Journey - Happy Path', () => {
    test('should complete full user journey: signup → verification → login → dashboard access', async ({ page }) => {
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      // Step 1: User signs up
      await authHelpers.signUp(email, password);
      await expect(page.getByText(/check your email/i)).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();

      // Step 2: User clicks verification link from email
      const verificationToken = AuthTestData.generateToken();
      await authHelpers.verifyEmail(verificationToken);
      await expect(page.getByRole('heading', { name: /email verified/i })).toBeVisible();

      // Step 3: User is automatically logged in and redirected to dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 });
      await authHelpers.expectLoggedIn();

      // Step 4: User can log out and log back in
      await page.getByRole('button', { name: /sign out|log out/i }).click();
      await authHelpers.expectLoggedOut();

      // Step 5: User logs back in successfully
      await authHelpers.logIn(email, password);
      await page.waitForURL('/dashboard');
      await authHelpers.expectLoggedIn();
    });

    test('should handle guest user upgrade during signup flow', async ({ page }) => {
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      // Step 1: Set anonymous session (guest user)
      const anonymousSessionId = await authHelpers.setAnonymousSession();

      // Step 2: Guest user signs up
      await authHelpers.signUp(email, password);
      await expect(page.getByText(/check your email/i)).toBeVisible();

      // Step 3: Verify email and complete signup
      const verificationToken = AuthTestData.generateToken();
      await authHelpers.verifyEmail(verificationToken);

      // Step 4: Should be logged in and anonymous session should be cleared
      await page.waitForURL('/dashboard');
      await authHelpers.expectLoggedIn();
      await authHelpers.expectAnonymousSessionCleared();
    });
  });

  test.describe('Password Reset Complete Flow', () => {
    test('should complete full password reset: request → reset → login with new password', async ({ page }) => {
      const email = AuthTestData.generateEmail();
      const oldPassword = AuthTestData.generatePassword();
      const newPassword = 'NewSecurePassword123!';

      // Step 1: User exists with old password (simulated)
      // This would normally require user creation first, but mocked for testing

      // Step 2: User requests password reset
      await authHelpers.requestPasswordReset(email);
      await expect(page.getByText(/check your email/i)).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();

      // Step 3: User clicks reset link and sets new password
      const resetToken = AuthTestData.generateToken();
      await authHelpers.resetPassword(resetToken, newPassword);
      await expect(page.getByText(/password updated successfully/i)).toBeVisible();

      // Step 4: User is redirected to login page
      await page.waitForURL('/login');

      // Step 5: User logs in with new password
      await authHelpers.logIn(email, newPassword);
      await page.waitForURL('/dashboard');
      await authHelpers.expectLoggedIn();
    });

    test('should handle password reset with invalid/expired tokens', async ({ page }) => {
      const email = AuthTestData.generateEmail();

      // Request password reset
      await authHelpers.requestPasswordReset(email);
      await expect(page.getByText(/check your email/i)).toBeVisible();

      // Mock invalid token verification
      await page.route('**/auth/v1/verify', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid or expired reset token',
          }),
        });
      });

      // Try to reset with invalid token
      const invalidToken = 'invalid-token';
      await authHelpers.verifyEmail(invalidToken);
      await expect(page.getByText(/invalid or expired reset token/i)).toBeVisible();

      // Should provide option to request new reset
      await expect(page.getByRole('link', { name: /request new reset link/i })).toBeVisible();
    });
  });

  test.describe('Email Confirmation and Resend Flow', () => {
    test('should handle unconfirmed email login with resend functionality', async ({ page }) => {
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

      // Attempt login
      await authHelpers.logIn(email, password);

      // Should show unconfirmed email warning
      await authHelpers.expectUnconfirmedEmailWarning();
      await expect(page.getByRole('button', { name: /resend confirmation/i })).toBeVisible();

      // Click resend confirmation
      await authHelpers.clickResendConfirmation();
      await expect(page.getByText(/confirmation email sent/i)).toBeVisible();

      // Now verify email
      const verificationToken = AuthTestData.generateToken();
      await authHelpers.verifyEmail(verificationToken);
      await expect(page.getByText(/email verified/i)).toBeVisible();

      // Should redirect to dashboard
      await page.waitForURL('/dashboard');
      await authHelpers.expectLoggedIn();
    });

    test('should handle multiple resend attempts with rate limiting', async ({ page }) => {
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

      // First resend should work
      await authHelpers.clickResendConfirmation();
      await expect(page.getByText(/confirmation email sent/i)).toBeVisible();

      // Mock rate limiting for subsequent requests
      await page.route('**/api/auth/resend-confirmation', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Too many requests. Please wait before trying again.',
          }),
        });
      });

      // Second resend should show rate limiting
      await authHelpers.clickResendConfirmation();
      await expect(page.getByText(/too many requests/i)).toBeVisible();
    });
  });

  test.describe('Error States and Recovery Flows', () => {
    test('should handle signup errors and allow retry', async ({ page }) => {
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      // Mock signup error
      await page.route('**/api/auth/signup', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Email already registered',
          }),
        });
      });

      // Attempt signup
      await authHelpers.signUp(email, password);
      await expect(page.getByText(/email already registered/i)).toBeVisible();

      // Should remain on signup page for retry
      expect(page.url()).toContain('/signup');
      await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();

      // User can navigate to login instead
      await page.getByRole('link', { name: /sign in|log in/i }).click();
      await page.waitForURL('/login');
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    });

    test('should handle login errors and maintain form state', async ({ page }) => {
      const email = AuthTestData.generateEmail();
      const password = 'wrongpassword';

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

      await authHelpers.logIn(email, password);
      await expect(page.getByText(/invalid login credentials/i)).toBeVisible();

      // Email should be preserved, password should be cleared
      const emailInput = page.getByPlaceholder(/email address/i);
      const passwordInput = page.getByPlaceholder(/password/i);
      
      await expect(emailInput).toHaveValue(email);
      await expect(passwordInput).toHaveValue('');

      // User can try again or go to forgot password
      await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ page }) => {
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      // Mock network failure
      await page.route('**/auth/v1/token', async (route) => {
        await route.abort('failed');
      });

      await authHelpers.logIn(email, password);
      await expect(page.getByText(/network error|something went wrong/i)).toBeVisible();

      // Form should remain functional for retry
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should handle server errors with fallback messaging', async ({ page }) => {
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      // Mock server error
      await page.route('**/api/auth/signup', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error',
          }),
        });
      });

      await authHelpers.signUp(email, password);
      await expect(page.getByText(/something went wrong|try again/i)).toBeVisible();
    });
  });

  test.describe('Rate Limiting and Security', () => {
    test('should enforce rate limiting on signup attempts', async ({ page }) => {
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      // Mock rate limiting after first attempt
      let attemptCount = 0;
      await page.route('**/api/auth/signup', async (route) => {
        attemptCount++;
        if (attemptCount > 3) {
          await route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Too many signup attempts. Please wait before trying again.',
            }),
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Signup failed',
            }),
          });
        }
      });

      // Make multiple signup attempts
      for (let i = 0; i < 4; i++) {
        await page.goto('/signup');
        await page.getByPlaceholder(/email address/i).fill(email);
        await page.getByPlaceholder(/password/i).fill(password);
        await page.getByRole('button', { name: /sign up/i }).click();
        
        if (i < 3) {
          await expect(page.getByText(/signup failed/i)).toBeVisible();
        } else {
          await expect(page.getByText(/too many signup attempts/i)).toBeVisible();
        }
      }
    });

    test('should prevent rapid form submissions', async ({ page }) => {
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      await page.goto('/signup');
      await page.getByPlaceholder(/email address/i).fill(email);
      await page.getByPlaceholder(/password/i).fill(password);

      // Submit form
      const submitButton = page.getByRole('button', { name: /sign up/i });
      await submitButton.click();

      // Button should be disabled to prevent double submission
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toHaveText(/signing up/i);
    });

    test('should enforce rate limiting on password reset requests', async ({ page }) => {
      const email = AuthTestData.generateEmail();

      // Mock rate limiting after first attempt
      let resetAttempts = 0;
      await page.route('**/api/auth/password-reset', async (route) => {
        resetAttempts++;
        if (resetAttempts > 2) {
          await route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Too many reset requests. Please wait before trying again.',
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'ok',
            }),
          });
        }
      });

      // Make multiple reset requests
      for (let i = 0; i < 3; i++) {
        await page.goto('/forgot-password');
        await page.getByPlaceholder(/email address/i).fill(email);
        await page.getByRole('button', { name: /send reset link/i }).click();
        
        if (i < 2) {
          await expect(page.getByText(/check your email/i)).toBeVisible();
        } else {
          await expect(page.getByText(/too many reset requests/i)).toBeVisible();
        }
      }
    });
  });

  test.describe('Cross-Browser Authentication Features', () => {
    test('should maintain authentication state across browser tabs', async ({ page, context }) => {
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      // Log in on first tab
      await authHelpers.signUp(email, password);
      const verificationToken = AuthTestData.generateToken();
      await authHelpers.verifyEmail(verificationToken);
      await page.waitForURL('/dashboard');
      await authHelpers.expectLoggedIn();

      // Open second tab
      const page2 = await context.newPage();
      await page2.goto('/dashboard');

      // Should be authenticated on second tab too
      const authHelpers2 = new AuthHelpers(page2);
      await authHelpers2.expectLoggedIn();

      // Logout from first tab
      await page.getByRole('button', { name: /sign out|log out/i }).click();
      await authHelpers.expectLoggedOut();

      // Second tab should also be logged out (session sync)
      await page2.reload();
      await authHelpers2.expectLoggedOut();

      await page2.close();
    });

    test('should handle concurrent login attempts', async ({ page, context }) => {
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      // Open second page
      const page2 = await context.newPage();
      const authHelpers2 = new AuthHelpers(page2);
      await authHelpers2.mockSupabaseAuth();
      await authHelpers2.mockInternalAPIs();

      // Attempt login from both pages simultaneously
      const login1Promise = authHelpers.logIn(email, password);
      const login2Promise = authHelpers2.logIn(email, password);

      // Both should handle gracefully
      await Promise.all([login1Promise, login2Promise]);

      // Both should succeed
      await page.waitForURL('/dashboard');
      await page2.waitForURL('/dashboard');

      await authHelpers.expectLoggedIn();
      await authHelpers2.expectLoggedIn();

      await page2.close();
    });
  });

  test.describe('User Experience and Accessibility', () => {
    test('should provide clear navigation between auth pages', async ({ page }) => {
      // Start on login page
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

      // Navigate to signup
      await page.getByRole('link', { name: /create account|sign up/i }).click();
      await page.waitForURL('/signup');
      await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();

      // Navigate to forgot password
      await page.getByRole('link', { name: /sign in|log in/i }).click();
      await page.waitForURL('/login');
      await page.getByRole('link', { name: /forgot password/i }).click();
      await page.waitForURL('/forgot-password');
      await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();

      // Navigate back to login
      await page.getByRole('link', { name: /back to login/i }).click();
      await page.waitForURL('/login');
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    });

    test('should redirect authenticated users away from auth pages', async ({ page }) => {
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

      // Try to access each auth page when authenticated
      const authPages = ['/login', '/signup', '/forgot-password'];
      
      for (const authPage of authPages) {
        await page.goto(authPage);
        await page.waitForURL('/dashboard');
        await authHelpers.expectLoggedIn();
      }
    });

    test('should handle users without early access', async ({ page }) => {
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

      // Should redirect to early access page
      await page.waitForURL('/early-access-coming-soon');
      expect(page.url()).toContain('/early-access-coming-soon');
    });
  });

  test.describe('Mobile and Responsive Design', () => {
    test('should maintain usability on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const authPages = [
        { url: '/login', heading: /sign in/i },
        { url: '/signup', heading: /create your account/i },
        { url: '/forgot-password', heading: /reset your password/i },
      ];

      for (const authPage of authPages) {
        await page.goto(authPage.url);
        await expect(page.getByRole('heading', { name: authPage.heading })).toBeVisible();

        // Form should fit viewport
        const form = page.locator('form');
        await expect(form).toBeVisible();
        
        const formBoundingBox = await form.boundingBox();
        expect(formBoundingBox?.width).toBeLessThanOrEqual(375);

        // Input fields should be easily tappable (minimum 44px height)
        const inputs = page.locator('input');
        const inputCount = await inputs.count();
        for (let i = 0; i < inputCount; i++) {
          const inputBoundingBox = await inputs.nth(i).boundingBox();
          expect(inputBoundingBox?.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should work with touch interactions on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const email = AuthTestData.generateEmail();
      const password = AuthTestData.generatePassword();

      await page.goto('/signup');

      // Use tap instead of click for mobile
      await page.getByPlaceholder(/email address/i).tap();
      await page.getByPlaceholder(/email address/i).fill(email);

      await page.getByPlaceholder(/password/i).tap();
      await page.getByPlaceholder(/password/i).fill(password);

      await page.getByRole('button', { name: /sign up/i }).tap();

      // Should work the same as desktop
      await expect(page.getByText(/check your email/i)).toBeVisible();
    });
  });

  test.describe('Analytics and Tracking', () => {
    test('should track authentication events', async ({ page }) => {
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

      // Test signup analytics
      await authHelpers.signUp(email, password);

      // Check analytics events
      let events = await page.evaluate(() => (window as any)._analyticsEvents || []);
      
      const signupEvent = events.find((e: any) => e.event.includes('signup'));
      expect(signupEvent).toBeTruthy();

      // Test login analytics
      await authHelpers.logIn(email, password);

      events = await page.evaluate(() => (window as any)._analyticsEvents || []);
      
      const loginEvent = events.find((e: any) => e.event.includes('login'));
      expect(loginEvent).toBeTruthy();
    });
  });
});