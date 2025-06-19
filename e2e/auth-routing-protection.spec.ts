/**
 * E2E Tests: Authentication Routing and Route Protection
 * 
 * Tests route guards, early access controls, and authentication-based
 * navigation behavior across the application.
 */

import { test, expect } from '@playwright/test';
import { AuthHelpers, AuthTestData } from './helpers/auth-helpers';

test.describe('Authentication Routing Protection', () => {
  let authHelpers: AuthHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page);
    await authHelpers.mockSupabaseAuth();
    await authHelpers.mockInternalAPIs();
  });

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    const protectedRoutes = ['/dashboard', '/practice', '/diagnostic/results'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login
      await page.waitForURL('/login');
      expect(page.url()).toContain('/login');
    }
  });

  test('should allow access to public routes without authentication', async ({ page }) => {
    const publicRoutes = ['/', '/login', '/signup', '/forgot-password', '/verify-email', '/diagnostic'];

    for (const route of publicRoutes) {
      await page.goto(route);
      
      // Should stay on the route (not redirect to login)
      expect(page.url()).toContain(route);
    }
  });

  test('should redirect authenticated users away from auth pages', async ({ page }) => {
    // Mock authenticated session with early access
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

    const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];

    for (const route of authRoutes) {
      await page.goto(route);
      
      // Should redirect to dashboard
      await page.waitForURL('/dashboard');
      expect(page.url()).toContain('/dashboard');
    }
  });

  test('should enforce early access restrictions', async ({ page }) => {
    // Mock authenticated session WITHOUT early access
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'user@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { is_early_access: false },
          },
        }),
      });
    });

    const protectedRoutes = ['/dashboard', '/practice'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to early access coming soon page
      await page.waitForURL('/early-access-coming-soon');
      expect(page.url()).toContain('/early-access-coming-soon');
    }
  });

  test('should allow early access users to access protected routes', async ({ page }) => {
    // Mock authenticated session WITH early access
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'earlyaccess@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { is_early_access: true },
          },
        }),
      });
    });

    const protectedRoutes = ['/dashboard', '/practice'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should stay on the protected route
      expect(page.url()).toContain(route);
      
      // Should not redirect to coming soon page
      expect(page.url()).not.toContain('/early-access-coming-soon');
    }
  });

  test('should handle missing user metadata gracefully', async ({ page }) => {
    // Mock authenticated session with missing metadata
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'nometadata@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: {}, // No early access metadata
          },
        }),
      });
    });

    await page.goto('/dashboard');
    
    // Should treat missing metadata as no early access
    await page.waitForURL('/early-access-coming-soon');
    expect(page.url()).toContain('/early-access-coming-soon');
  });

  test('should handle authentication state changes during navigation', async ({ page }) => {
    // Start unauthenticated
    await page.goto('/dashboard');
    await page.waitForURL('/login');

    // Mock successful authentication
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'user@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { is_early_access: true },
          },
        }),
      });
    });

    // Simulate authentication state change
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('auth-state-changed'));
    });

    // Navigate to protected route again
    await page.goto('/dashboard');
    
    // Should now have access
    expect(page.url()).toContain('/dashboard');
  });

  test('should handle logout and redirect appropriately', async ({ page }) => {
    // Mock authenticated session initially
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'user@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { is_early_access: true },
          },
        }),
      });
    });

    await page.goto('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // Mock logout (remove authentication)
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'No session',
        }),
      });
    });

    // Navigate to protected route after logout
    await page.goto('/dashboard');
    
    // Should redirect to login
    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });

  test('should preserve intended destination after login', async ({ page }) => {
    // Try to access protected route while unauthenticated
    await page.goto('/dashboard/settings');
    await page.waitForURL('/login');

    // Complete login
    const email = AuthTestData.generateEmail();
    const password = AuthTestData.generatePassword();

    // Mock successful login with early access
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

    // Should redirect to originally intended destination
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');
  });

  test('should handle concurrent navigation and authentication checks', async ({ page }) => {
    // Mock slow authentication check
    let authCallCount = 0;
    await page.route('**/auth/v1/user', async (route) => {
      authCallCount++;
      
      // Simulate slow network
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'user@example.com',
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { is_early_access: true },
          },
        }),
      });
    });

    // Navigate rapidly between routes
    const navigationPromises = [
      page.goto('/dashboard'),
      page.goto('/practice'),
      page.goto('/dashboard'),
    ];

    await Promise.all(navigationPromises);

    // Should end up on last requested route
    expect(page.url()).toContain('/dashboard');
    
    // Should not make excessive auth calls
    expect(authCallCount).toBeLessThan(10);
  });

  test('should handle network errors during authentication checks', async ({ page }) => {
    // Mock network failure for auth check
    await page.route('**/auth/v1/user', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/dashboard');

    // Should redirect to login on auth failure
    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });

  test('should respect browser back/forward navigation with auth state', async ({ page }) => {
    // Start on public page
    await page.goto('/');
    
    // Navigate to login
    await page.goto('/login');
    
    // Navigate to public page
    await page.goto('/diagnostic');
    
    // Use browser back button
    await page.goBack();
    expect(page.url()).toContain('/login');
    
    // Use browser forward button
    await page.goForward();
    expect(page.url()).toContain('/diagnostic');
    
    // Try to navigate to protected route
    await page.goto('/dashboard');
    await page.waitForURL('/login');
    
    // Browser back should work correctly
    await page.goBack();
    expect(page.url()).toContain('/diagnostic');
  });

  test('should handle deep links with authentication requirements', async ({ page }) => {
    const deepLinks = [
      '/dashboard/analytics',
      '/practice/section/1',
      '/diagnostic/session/abc123',
    ];

    for (const link of deepLinks) {
      await page.goto(link);
      
      // Should redirect to login
      await page.waitForURL('/login');
      expect(page.url()).toContain('/login');
    }
  });

  test('should handle authentication timeout scenarios', async ({ page }) => {
    // Mock initial authentication success
    let isAuthenticated = true;
    await page.route('**/auth/v1/user', async (route) => {
      if (isAuthenticated) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'mock-user-id',
              email: 'user@example.com',
              email_confirmed_at: new Date().toISOString(),
              user_metadata: { is_early_access: true },
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session expired' }),
        });
      }
    });

    // Navigate to protected route
    await page.goto('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // Simulate session expiration
    isAuthenticated = false;

    // Navigate to another protected route
    await page.goto('/practice');
    
    // Should redirect to login due to expired session
    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });
});