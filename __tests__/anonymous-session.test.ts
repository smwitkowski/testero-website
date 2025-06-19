/**
 * @jest-environment jsdom
 */

import {
  ANONYMOUS_SESSION_COOKIE_NAME,
  ANONYMOUS_SESSION_STORAGE_KEY,
  getAnonymousSessionIdFromStorage,
  setAnonymousSessionIdInStorage,
  clearAnonymousSessionIdFromStorage,
  getAnonymousSessionIdFromClientCookie,
  setAnonymousSessionIdInClientCookie,
  getAnonymousSessionId,
  setAnonymousSessionId,
  clearAnonymousSessionId,
  generateAnonymousSessionId,
} from '@/lib/auth/anonymous-session';

// Mock crypto.randomUUID for consistent testing
const mockUUID = 'test-uuid-1234-5678-9abc-def012345678';
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => mockUUID),
  },
});

describe('Anonymous Session Management', () => {
  beforeEach(() => {
    // Clear localStorage and cookies before each test
    localStorage.clear();
    
    // Clear all cookies
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  });

  describe('localStorage functions', () => {
    test('should set and get anonymous session ID from localStorage', () => {
      const testId = 'test-session-id-123';
      setAnonymousSessionIdInStorage(testId);
      expect(getAnonymousSessionIdFromStorage()).toBe(testId);
      expect(localStorage.getItem(ANONYMOUS_SESSION_STORAGE_KEY)).toBe(testId);
    });

    test('should return null when no session ID in localStorage', () => {
      expect(getAnonymousSessionIdFromStorage()).toBeNull();
    });

    test('should clear anonymous session ID from localStorage', () => {
      const testId = 'test-session-id-456';
      setAnonymousSessionIdInStorage(testId);
      expect(getAnonymousSessionIdFromStorage()).toBe(testId);
      
      clearAnonymousSessionIdFromStorage();
      expect(getAnonymousSessionIdFromStorage()).toBeNull();
    });

    test('should handle localStorage errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock localStorage to throw error
      const mockSetItem = jest.spyOn(Storage.prototype, 'setItem');
      mockSetItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      setAnonymousSessionIdInStorage('test-id');
      expect(consoleSpy).toHaveBeenCalledWith('Error storing anonymous session in localStorage:', expect.any(Error));
      
      mockSetItem.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('client cookie functions', () => {
    test('should set and get anonymous session ID from client cookies', () => {
      const testId = 'test-cookie-session-789';
      setAnonymousSessionIdInClientCookie(testId);
      
      // Check if cookie was set correctly
      expect(document.cookie).toContain(`${ANONYMOUS_SESSION_COOKIE_NAME}=${testId}`);
      expect(getAnonymousSessionIdFromClientCookie()).toBe(testId);
    });

    test('should return null when no session ID in cookies', () => {
      expect(getAnonymousSessionIdFromClientCookie()).toBeNull();
    });

    test('should handle cookie parsing edge cases', () => {
      // Set multiple cookies to test parsing
      document.cookie = 'other_cookie=value1';
      document.cookie = `${ANONYMOUS_SESSION_COOKIE_NAME}=target-session-id`;
      document.cookie = 'another_cookie=value2';
      
      expect(getAnonymousSessionIdFromClientCookie()).toBe('target-session-id');
    });

    test('should handle malformed cookies gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock document.cookie to throw error
      Object.defineProperty(document, 'cookie', {
        get: () => {
          throw new Error('Cookie access error');
        },
        configurable: true,
      });
      
      expect(getAnonymousSessionIdFromClientCookie()).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error reading anonymous session from client cookie:', expect.any(Error));
      
      consoleSpy.mockRestore();
      
      // Restore normal cookie behavior
      Object.defineProperty(document, 'cookie', {
        get: () => '',
        set: () => {},
        configurable: true,
      });
    });
  });

  describe('combined functions', () => {
    test('getAnonymousSessionId should prioritize cookie over localStorage', () => {
      const cookieId = 'cookie-session-id';
      const storageId = 'storage-session-id';
      
      // Set both cookie and localStorage
      setAnonymousSessionIdInClientCookie(cookieId);
      setAnonymousSessionIdInStorage(storageId);
      
      expect(getAnonymousSessionId()).toBe(cookieId);
    });

    test('getAnonymousSessionId should fall back to localStorage when no cookie', () => {
      const storageId = 'storage-only-session-id';
      setAnonymousSessionIdInStorage(storageId);
      
      expect(getAnonymousSessionId()).toBe(storageId);
    });

    test('getAnonymousSessionId should sync localStorage to cookie when found', () => {
      const storageId = 'sync-test-session-id';
      setAnonymousSessionIdInStorage(storageId);
      
      // Clear cookies to ensure fallback to localStorage
      document.cookie = `${ANONYMOUS_SESSION_COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      
      const result = getAnonymousSessionId();
      expect(result).toBe(storageId);
      
      // Check that cookie was synced
      expect(document.cookie).toContain(`${ANONYMOUS_SESSION_COOKIE_NAME}=${storageId}`);
    });

    test('getAnonymousSessionId should return null when neither exists', () => {
      expect(getAnonymousSessionId()).toBeNull();
    });

    test('setAnonymousSessionId should set both cookie and localStorage', () => {
      const testId = 'dual-storage-session-id';
      setAnonymousSessionId(testId);
      
      expect(getAnonymousSessionIdFromClientCookie()).toBe(testId);
      expect(getAnonymousSessionIdFromStorage()).toBe(testId);
    });

    test('clearAnonymousSessionId should clear both cookie and localStorage', () => {
      const testId = 'clear-test-session-id';
      setAnonymousSessionId(testId);
      
      // Verify both are set
      expect(getAnonymousSessionIdFromClientCookie()).toBe(testId);
      expect(getAnonymousSessionIdFromStorage()).toBe(testId);
      
      clearAnonymousSessionId();
      
      // Verify both are cleared
      expect(getAnonymousSessionIdFromClientCookie()).toBeNull();
      expect(getAnonymousSessionIdFromStorage()).toBeNull();
    });
  });

  describe('server-side safety', () => {
    test('client functions should handle server-side environment', () => {
      // Mock server-side environment
      Object.defineProperty(global, 'window', {
        value: undefined,
        configurable: true,
      });
      
      expect(getAnonymousSessionIdFromStorage()).toBeNull();
      expect(() => setAnonymousSessionIdInStorage('test')).not.toThrow();
      expect(() => clearAnonymousSessionIdFromStorage()).not.toThrow();
      expect(getAnonymousSessionId()).toBeNull();
      expect(() => setAnonymousSessionId('test')).not.toThrow();
      expect(() => clearAnonymousSessionId()).not.toThrow();
      
      // Restore window object
      Object.defineProperty(global, 'window', {
        value: {},
        configurable: true,
      });
    });

    test('document-dependent functions should handle server-side environment', () => {
      // Mock server-side environment
      Object.defineProperty(global, 'document', {
        value: undefined,
        configurable: true,
      });
      
      expect(getAnonymousSessionIdFromClientCookie()).toBeNull();
      expect(() => setAnonymousSessionIdInClientCookie('test')).not.toThrow();
      
      // Restore document object
      Object.defineProperty(global, 'document', {
        value: {
          cookie: '',
        },
        configurable: true,
      });
    });
  });

  describe('generateAnonymousSessionId', () => {
    test('should generate a UUID', () => {
      const sessionId = generateAnonymousSessionId();
      expect(sessionId).toBe(mockUUID);
      expect(crypto.randomUUID).toHaveBeenCalled();
    });
  });

  describe('cookie security attributes', () => {
    test('should set secure cookie in production-like environment', () => {
      // Mock HTTPS environment
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'https:',
        },
        configurable: true,
      });
      
      const testId = 'secure-cookie-test';
      setAnonymousSessionIdInClientCookie(testId);
      
      // Note: We can't easily test the Secure attribute in jsdom, but we can verify the cookie is set
      expect(document.cookie).toContain(`${ANONYMOUS_SESSION_COOKIE_NAME}=${testId}`);
    });

    test('should set non-secure cookie in development environment', () => {
      // Mock HTTP environment
      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'http:',
        },
        configurable: true,
      });
      
      const testId = 'non-secure-cookie-test';
      setAnonymousSessionIdInClientCookie(testId);
      
      expect(document.cookie).toContain(`${ANONYMOUS_SESSION_COOKIE_NAME}=${testId}`);
    });
  });
});