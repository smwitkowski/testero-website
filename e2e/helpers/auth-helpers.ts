/**
 * Auth Test Helpers for E2E Testing
 * 
 * Provides utilities for testing authentication flows including signup,
 * login, password reset, email verification, and guest session upgrades.
 */

import { Page, expect } from '@playwright/test';

export class AuthHelpers {
  constructor(private page: Page) {}

  /**
   * Mock email verification token for testing
   */
  async mockEmailVerificationToken(): Promise<string> {
    // Generate a mock verification token for testing
    return 'mock-verification-token-' + Date.now();
  }

  /**
   * Fill and submit signup form
   */
  async signUp(email: string, password: string) {
    await this.page.goto('/signup');
    
    // Wait for form to be ready
    await expect(this.page.getByRole('heading', { name: /create your account/i })).toBeVisible();
    
    // Fill form
    await this.page.getByPlaceholder(/email address/i).fill(email);
    await this.page.getByPlaceholder(/password/i).fill(password);
    
    // Submit form
    await this.page.getByRole('button', { name: /sign up/i }).click();
    
    // Wait for success state
    await expect(this.page.getByText(/check your email/i)).toBeVisible();
  }

  /**
   * Fill and submit login form
   */
  async logIn(email: string, password: string) {
    await this.page.goto('/login');
    
    // Wait for form to be ready
    await expect(this.page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    
    // Fill form
    await this.page.getByPlaceholder(/email address/i).fill(email);
    await this.page.getByPlaceholder(/password/i).fill(password);
    
    // Submit form
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  /**
   * Simulate email verification by navigating to verify-email page with token
   */
  async verifyEmail(token?: string) {
    const verificationToken = token || await this.mockEmailVerificationToken();
    await this.page.goto(`/verify-email?token=${verificationToken}`);
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string) {
    await this.page.goto('/forgot-password');
    
    // Wait for form to be ready
    await expect(this.page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    
    // Fill email
    await this.page.getByPlaceholder(/email address/i).fill(email);
    
    // Submit form
    await this.page.getByRole('button', { name: /send reset link/i }).click();
    
    // Wait for success state
    await expect(this.page.getByText(/check your email/i)).toBeVisible();
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string) {
    await this.page.goto(`/reset-password?token=${token}`);
    
    // Wait for form to be ready
    await expect(this.page.getByRole('heading', { name: /set new password/i })).toBeVisible();
    
    // Fill new password
    await this.page.getByPlaceholder(/new password/i).fill(newPassword);
    await this.page.getByPlaceholder(/confirm password/i).fill(newPassword);
    
    // Submit form
    await this.page.getByRole('button', { name: /update password/i }).click();
  }

  /**
   * Click resend confirmation link
   */
  async clickResendConfirmation() {
    await this.page.getByRole('button', { name: /resend confirmation/i }).click();
  }

  /**
   * Check if user is logged in by looking for dashboard or authenticated content
   */
  async expectLoggedIn() {
    // Wait for redirect to dashboard or authenticated page
    await this.page.waitForURL(/\/dashboard|\/practice|\/diagnostic/);
    
    // Should not be on login/signup pages
    expect(this.page.url()).not.toMatch(/\/login|\/signup/);
  }

  /**
   * Check if user is logged out by looking for login page or public content
   */
  async expectLoggedOut() {
    // Should be redirected to login for protected pages
    const currentUrl = this.page.url();
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/practice')) {
      await this.page.waitForURL('/login');
    }
  }

  /**
   * Check for unconfirmed email warning on login page
   */
  async expectUnconfirmedEmailWarning() {
    await expect(this.page.getByText(/please confirm your email/i)).toBeVisible();
    await expect(this.page.getByRole('button', { name: /resend confirmation/i })).toBeVisible();
  }

  /**
   * Check for error message display
   */
  async expectErrorMessage(message: string) {
    await expect(this.page.getByText(new RegExp(message, 'i'))).toBeVisible();
  }

  /**
   * Check for success message display
   */
  async expectSuccessMessage(message: string) {
    await expect(this.page.getByText(new RegExp(message, 'i'))).toBeVisible();
  }

  /**
   * Set anonymous session ID in localStorage to simulate guest user
   */
  async setAnonymousSession(sessionId?: string) {
    const anonymousId = sessionId || 'test-anonymous-session-' + Date.now();
    
    await this.page.evaluate((id) => {
      localStorage.setItem('anonymousSessionId', id);
      // Also set cookie for server-side detection
      document.cookie = `testero_anonymous_session_id=${id}; path=/`;
    }, anonymousId);
    
    return anonymousId;
  }

  /**
   * Check if anonymous session ID is cleared after signup
   */
  async expectAnonymousSessionCleared() {
    const storageId = await this.page.evaluate(() => {
      return localStorage.getItem('anonymousSessionId');
    });
    
    expect(storageId).toBeNull();
  }

  /**
   * Mock Supabase auth responses for testing
   */
  async mockSupabaseAuth() {
    await this.page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      
      // Mock signup
      if (url.includes('/signup') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'mock-user-id',
              email: 'test@example.com',
              email_confirmed_at: null,
            },
            session: null,
          }),
        });
      }
      // Mock email verification
      else if (url.includes('/verify') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'mock-user-id',
              email: 'test@example.com',
              email_confirmed_at: new Date().toISOString(),
            },
            session: {
              access_token: 'mock-access-token',
              refresh_token: 'mock-refresh-token',
            },
          }),
        });
      }
      // Mock login
      else if (url.includes('/token') && method === 'POST') {
        const body = await route.request().postDataJSON();
        if (body.grant_type === 'password') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              user: {
                id: 'mock-user-id',
                email: body.email,
                email_confirmed_at: new Date().toISOString(),
              },
              session: {
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token',
              },
            }),
          });
        }
      }
      // Default fallback
      else {
        await route.continue();
      }
    });
  }

  /**
   * Mock internal API routes for testing
   */
  async mockInternalAPIs() {
    // Mock signup API
    await this.page.route('**/api/auth/signup', async (route) => {
      const body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          guestUpgraded: !!body.anonymousSessionId,
          sessionsTransferred: body.anonymousSessionId ? 2 : 0,
        }),
      });
    });

    // Mock resend confirmation API
    await this.page.route('**/api/auth/resend-confirmation', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          message: 'Confirmation email sent',
        }),
      });
    });

    // Mock password reset API
    await this.page.route('**/api/auth/password-reset', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          message: 'Password reset email sent',
        }),
      });
    });
  }
}

/**
 * Test data generators
 */
export const AuthTestData = {
  /**
   * Generate unique test email
   */
  generateEmail(): string {
    return `test-${Date.now()}@example.com`;
  },

  /**
   * Generate test password
   */
  generatePassword(): string {
    return 'TestPassword123!';
  },

  /**
   * Generate mock verification token
   */
  generateToken(): string {
    return 'mock-token-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  },
};