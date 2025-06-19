/**
 * E2E Tests: Guest Session Upgrade During Signup
 * 
 * Tests the anonymous session upgrade functionality where guest users
 * who have taken diagnostics can sign up and retain their session history.
 */

import { test, expect } from '@playwright/test';
import { AuthHelpers, AuthTestData } from './helpers/auth-helpers';
import { DiagnosticHelpers } from './helpers/diagnostic-helpers';

test.describe('Guest Session Upgrade During Signup', () => {
  let authHelpers: AuthHelpers;
  let diagnosticHelpers: DiagnosticHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    diagnosticHelpers = new DiagnosticHelpers(page);
    
    // Mock all auth and diagnostic APIs
    await authHelpers.mockSupabaseAuth();
    await authHelpers.mockInternalAPIs();
    await diagnosticHelpers.setupApiMocks();
  });

  test('should upgrade anonymous session during signup flow', async ({ page }) => {
    // Step 1: Create anonymous session by starting a diagnostic as guest
    const anonymousSessionId = await authHelpers.setAnonymousSession();
    
    // Start a diagnostic session as anonymous user
    await page.goto('/diagnostic');
    
    // Start a new diagnostic session by clicking start button
    await page.getByRole('button', { name: /start diagnostic/i }).click();
    
    // Answer a few questions to create meaningful session data
    await page.getByRole('radio').first().click(); // Select first option
    await page.getByRole('button', { name: /next question/i }).click();
    await page.getByRole('radio').nth(1).click(); // Select second option
    await page.getByRole('button', { name: /next question/i }).click();
    
    // Step 2: Navigate to signup while maintaining anonymous session
    await page.goto('/signup');
    
    // Verify anonymous session is still present
    const sessionId = await page.evaluate(() => {
      return localStorage.getItem('anonymousSessionId');
    });
    expect(sessionId).toBe(anonymousSessionId);

    // Step 3: Complete signup process
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();
    
    await authHelpers.signUp(email, password);
    
    // Step 4: Verify success message indicates guest upgrade
    await expect(page.getByText(/check your email/i)).toBeVisible();
    
    // Step 5: Complete email verification
    const verificationToken = AuthTestData.generateToken();
    await authHelpers.verifyEmail(verificationToken);
    
    // Step 6: Verify successful verification and redirect
    await page.waitForURL('/dashboard');
    await authHelpers.expectLoggedIn();
    
    // Step 7: Verify anonymous session is cleared after upgrade
    await authHelpers.expectAnonymousSessionCleared();
  });

  test('should handle signup without existing anonymous session', async ({ page }) => {
    // Go directly to signup without any anonymous session
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();
    
    await authHelpers.signUp(email, password);
    
    // Should still work normally without guest upgrade
    await expect(page.getByText(/check your email/i)).toBeVisible();
    
    // Complete verification
    const verificationToken = AuthTestData.generateToken();
    await authHelpers.verifyEmail(verificationToken);
    
    await page.waitForURL('/dashboard');
    await authHelpers.expectLoggedIn();
  });

  test('should preserve anonymous session if signup fails', async ({ page }) => {
    // Set up anonymous session
    const anonymousSessionId = await authHelpers.setAnonymousSession();
    
    // Mock signup API error
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
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();
    
    await authHelpers.signUp(email, password);
    
    // Should show error
    await expect(page.getByText(/email already registered/i)).toBeVisible();
    
    // Anonymous session should still be preserved
    const sessionId = await page.evaluate(() => {
      return localStorage.getItem('anonymousSessionId');
    });
    expect(sessionId).toBe(anonymousSessionId);
  });

  test('should track guest upgrade analytics properly', async ({ page }) => {
    // Mock PostHog to capture analytics events
    const analyticsEvents: any[] = [];
    await page.addInitScript(() => {
      (window as any).posthog = {
        capture: (event: string, properties: any) => {
          (window as any)._analyticsEvents = (window as any)._analyticsEvents || [];
          (window as any)._analyticsEvents.push({ event, properties });
        }
      };
    });

    // Set up anonymous session with diagnostic data
    const anonymousSessionId = await authHelpers.setAnonymousSession();
    
    // Start and complete a diagnostic
    await page.goto('/diagnostic');
    await page.getByRole('button', { name: /start diagnostic/i }).click();
    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: /next question/i }).click();
    
    // Complete signup
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();
    
    await authHelpers.signUp(email, password);
    
    // Check analytics events were fired
    const events = await page.evaluate(() => (window as any)._analyticsEvents || []);
    
    // Should have signup attempt event
    const signupAttempt = events.find((e: any) => e.event === 'signup_attempt');
    expect(signupAttempt).toBeTruthy();
    expect(signupAttempt.properties.hasAnonymousSession).toBe(true);
    
    // Complete verification to trigger success analytics
    const verificationToken = AuthTestData.generateToken();
    await authHelpers.verifyEmail(verificationToken);
    
    await page.waitForURL('/dashboard');
    
    // Check for guest upgrade success analytics
    const updatedEvents = await page.evaluate(() => (window as any)._analyticsEvents || []);
    const signupSuccess = updatedEvents.find((e: any) => e.event === 'signup_success');
    expect(signupSuccess).toBeTruthy();
    expect(signupSuccess.properties.guestUpgraded).toBe(true);
    expect(signupSuccess.properties.sessionsTransferred).toBeGreaterThan(0);
  });

  test('should handle anonymous session from different browsers/devices', async ({ page, context }) => {
    // Simulate anonymous session created on different device
    const anonymousSessionId = 'cross-device-session-' + Date.now();
    
    // Set session ID in both localStorage and cookie
    await page.goto('/');
    await page.evaluate((sessionId) => {
      localStorage.setItem('anonymousSessionId', sessionId);
      document.cookie = `testero_anonymous_session_id=${sessionId}; path=/`;
    }, anonymousSessionId);
    
    // Navigate to signup
    await page.goto('/signup');
    
    // Complete signup
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();
    
    await authHelpers.signUp(email, password);
    
    // Should still handle the cross-device session
    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test('should gracefully handle corrupt anonymous session data', async ({ page }) => {
    // Set invalid/corrupt session data
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('anonymousSessionId', 'invalid-session-data-{}[]');
      document.cookie = 'testero_anonymous_session_id=corrupt-data; path=/';
    });
    
    // Attempt signup
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();
    
    await authHelpers.signUp(email, password);
    
    // Should still complete successfully without upgrade
    await expect(page.getByText(/check your email/i)).toBeVisible();
    
    // Complete verification
    const verificationToken = AuthTestData.generateToken();
    await authHelpers.verifyEmail(verificationToken);
    
    await page.waitForURL('/dashboard');
    await authHelpers.expectLoggedIn();
  });

  test('should display appropriate messaging for guest users during signup', async ({ page }) => {
    // Set up anonymous session
    await authHelpers.setAnonymousSession();
    
    // Start diagnostic to simulate guest activity
    await page.goto('/diagnostic');
    await page.getByRole('button', { name: /start diagnostic/i }).click();
    
    // Navigate to signup
    await page.goto('/signup');
    
    // Should show standard signup form (guest upgrade happens behind the scenes)
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
    await expect(page.getByText(/sign up to start practicing with testero/i)).toBeVisible();
    
    // Complete signup
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();
    
    await authHelpers.signUp(email, password);
    
    // Success message should be consistent regardless of guest status
    await expect(page.getByText(/check your email/i)).toBeVisible();
    await expect(page.getByText(/complete your registration/i)).toBeVisible();
  });

  test('should handle concurrent signup attempts with same anonymous session', async ({ page, context }) => {
    // This test simulates edge case where same anonymous session
    // might be used in multiple browser tabs
    
    const anonymousSessionId = await authHelpers.setAnonymousSession();
    
    // Open second page in same context (simulating multiple tabs)
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.evaluate((sessionId) => {
      localStorage.setItem('anonymousSessionId', sessionId);
    }, anonymousSessionId);
    
    // Mock auth for both pages
    await authHelpers.mockSupabaseAuth();
    await authHelpers.mockInternalAPIs();
    
    const authHelpers2 = new AuthHelpers(page2);
    await authHelpers2.mockSupabaseAuth();
    await authHelpers2.mockInternalAPIs();
    
    // Attempt signup on both pages with same session
    const email1 = AuthTestData.generateEmail();
    const email2 = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();
    
    // Start both signups
    const signup1Promise = authHelpers.signUp(email1, password);
    const signup2Promise = authHelpers2.signUp(email2, password);
    
    // Both should complete (though only one should get the session upgrade)
    await Promise.all([signup1Promise, signup2Promise]);
    
    await expect(page.getByText(/check your email/i)).toBeVisible();
    await expect(page2.getByText(/check your email/i)).toBeVisible();
    
    await page2.close();
  });
});