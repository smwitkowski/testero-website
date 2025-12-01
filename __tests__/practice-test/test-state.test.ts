/**
 * @jest-environment jsdom
 */
import { deriveTestStats, loadFlagsFromStorage, saveFlagsToStorage, clearFlagsFromStorage } from '@/hooks/usePracticeTestState';

describe('Practice Test State Logic', () => {
  const mockSessionId = 'test-session-123';
  const storageKey = `testero_practice_flags_${mockSessionId}`;

  beforeEach(() => {
    localStorage.clear();
  });

  describe('deriveTestStats', () => {
    it('calculates answeredCount correctly', () => {
      const answers = {
        'q1': 'A',
        'q2': 'B',
        'q3': null,
      };
      const stats = deriveTestStats(answers, 3, 0);
      expect(stats.answeredCount).toBe(2);
    });

    it('calculates unansweredCount correctly', () => {
      const answers = {
        'q1': 'A',
        'q2': null,
        'q3': null,
      };
      const stats = deriveTestStats(answers, 3, 0);
      expect(stats.unansweredCount).toBe(2);
    });

    it('calculates flaggedCount correctly', () => {
      const answers = {
        'q1': 'A',
        'q2': 'B',
      };
      const stats = deriveTestStats(answers, 2, 2); // 2 flagged
      expect(stats.flaggedCount).toBe(2);
    });

    it('calculates progress percentage based on current index', () => {
      const answers = {
        'q1': 'A',
        'q2': 'B',
      };
      const stats = deriveTestStats(answers, 10, 0, 2); // 10 total, current index 2 (0-based)
      // Progress = (2 + 1) / 10 * 100 = 30%
      expect(stats.progressPercent).toBe(30);
    });

    it('handles empty answers', () => {
      const answers = {};
      const stats = deriveTestStats(answers, 5, 0);
      expect(stats.answeredCount).toBe(0);
      expect(stats.unansweredCount).toBe(5);
    });

    it('handles all questions answered', () => {
      const answers = {
        'q1': 'A',
        'q2': 'B',
        'q3': 'C',
      };
      const stats = deriveTestStats(answers, 3, 0);
      expect(stats.answeredCount).toBe(3);
      expect(stats.unansweredCount).toBe(0);
    });
  });

  describe('flagPersistence', () => {
    it('saves flags to localStorage with session-specific key', () => {
      const flags = new Set(['q1', 'q2']);
      saveFlagsToStorage(mockSessionId, flags);
      
      const stored = localStorage.getItem(storageKey);
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual(['q1', 'q2']);
    });

    it('loads flags from localStorage on init', () => {
      localStorage.setItem(storageKey, JSON.stringify(['q1', 'q3']));
      
      const flags = loadFlagsFromStorage(mockSessionId);
      expect(flags).toEqual(new Set(['q1', 'q3']));
    });

    it('returns empty set when no flags stored', () => {
      const flags = loadFlagsFromStorage(mockSessionId);
      expect(flags).toEqual(new Set());
    });

    it('clears flags on session completion', () => {
      localStorage.setItem(storageKey, JSON.stringify(['q1', 'q2']));
      
      clearFlagsFromStorage(mockSessionId);
      
      const stored = localStorage.getItem(storageKey);
      expect(stored).toBeNull();
    });

    it('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem(storageKey, 'invalid json');
      
      const flags = loadFlagsFromStorage(mockSessionId);
      expect(flags).toEqual(new Set());
    });

    it('handles different session IDs independently', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      
      saveFlagsToStorage(session1, new Set(['q1']));
      saveFlagsToStorage(session2, new Set(['q2']));
      
      expect(loadFlagsFromStorage(session1)).toEqual(new Set(['q1']));
      expect(loadFlagsFromStorage(session2)).toEqual(new Set(['q2']));
    });
  });
});



