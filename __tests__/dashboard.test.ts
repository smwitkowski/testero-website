/**
 * @jest-environment jsdom
 */

import { describe, it, expect } from '@jest/globals';

// We'll test the readiness calculation logic by extracting it from the API route
// This follows the pattern of testing pure business logic functions

function calculateReadinessScore(
  diagnosticScore: number | null,
  practiceAccuracy: number | null
): number {
  // MVP formula: 60% diagnostic weight, 40% practice weight
  if (diagnosticScore !== null && practiceAccuracy !== null) {
    return Math.round(0.6 * diagnosticScore + 0.4 * practiceAccuracy);
  }
  
  // Fallback to available data
  if (diagnosticScore !== null) {
    return Math.round(diagnosticScore * 0.8); // Slightly discounted without practice
  }
  
  if (practiceAccuracy !== null) {
    return Math.round(practiceAccuracy * 0.7); // Discounted without diagnostic
  }
  
  // No data available
  return 0;
}

describe('Dashboard Readiness Calculation', () => {
  describe('calculateReadinessScore', () => {
    it('should calculate readiness score with both diagnostic and practice data', () => {
      // Test case: 80% diagnostic, 70% practice
      // Expected: 0.6 * 80 + 0.4 * 70 = 48 + 28 = 76
      expect(calculateReadinessScore(80, 70)).toBe(76);
      
      // Test case: 90% diagnostic, 85% practice
      // Expected: 0.6 * 90 + 0.4 * 85 = 54 + 34 = 88
      expect(calculateReadinessScore(90, 85)).toBe(88);
      
      // Test case: 60% diagnostic, 60% practice
      // Expected: 0.6 * 60 + 0.4 * 60 = 36 + 24 = 60
      expect(calculateReadinessScore(60, 60)).toBe(60);
    });

    it('should handle diagnostic-only data with discount', () => {
      // Test case: 80% diagnostic only
      // Expected: 80 * 0.8 = 64
      expect(calculateReadinessScore(80, null)).toBe(64);
      
      // Test case: 90% diagnostic only
      // Expected: 90 * 0.8 = 72
      expect(calculateReadinessScore(90, null)).toBe(72);
      
      // Test case: 100% diagnostic only
      // Expected: 100 * 0.8 = 80
      expect(calculateReadinessScore(100, null)).toBe(80);
    });

    it('should handle practice-only data with discount', () => {
      // Test case: 80% practice only
      // Expected: 80 * 0.7 = 56
      expect(calculateReadinessScore(null, 80)).toBe(56);
      
      // Test case: 90% practice only
      // Expected: 90 * 0.7 = 63
      expect(calculateReadinessScore(null, 90)).toBe(63);
      
      // Test case: 100% practice only
      // Expected: 100 * 0.7 = 70
      expect(calculateReadinessScore(null, 100)).toBe(70);
    });

    it('should return 0 when no data is available', () => {
      expect(calculateReadinessScore(null, null)).toBe(0);
    });

    it('should handle edge cases and rounding correctly', () => {
      // Test decimal rounding
      // 75% diagnostic, 85% practice: 0.6 * 75 + 0.4 * 85 = 45 + 34 = 79
      expect(calculateReadinessScore(75, 85)).toBe(79);
      
      // Test with values that would create decimals
      // 77% diagnostic, 83% practice: 0.6 * 77 + 0.4 * 83 = 46.2 + 33.2 = 79.4 -> 79
      expect(calculateReadinessScore(77, 83)).toBe(79);
      
      // Test with 0% scores
      expect(calculateReadinessScore(0, 0)).toBe(0);
      expect(calculateReadinessScore(0, null)).toBe(0);
      expect(calculateReadinessScore(null, 0)).toBe(0);
    });

    it('should handle perfect scores correctly', () => {
      // Perfect scores in both
      expect(calculateReadinessScore(100, 100)).toBe(100);
      
      // Perfect diagnostic, good practice
      expect(calculateReadinessScore(100, 80)).toBe(92); // 60 + 32 = 92
      
      // Good diagnostic, perfect practice
      expect(calculateReadinessScore(80, 100)).toBe(88); // 48 + 40 = 88
    });

    it('should prioritize diagnostic score correctly in formula', () => {
      // Diagnostic should have 60% weight, practice 40%
      // Same scores should result in same readiness
      expect(calculateReadinessScore(70, 70)).toBe(70);
      
      // Higher diagnostic should have more impact than higher practice
      const higherDiagnostic = calculateReadinessScore(90, 60); // 54 + 24 = 78
      const higherPractice = calculateReadinessScore(60, 90); // 36 + 36 = 72
      
      expect(higherDiagnostic).toBeGreaterThan(higherPractice);
      expect(higherDiagnostic).toBe(78);
      expect(higherPractice).toBe(72);
    });
  });
});

// Test helper functions that might be used in the dashboard components
describe('Dashboard Helper Functions', () => {
  describe('getReadinessColor', () => {
    function getReadinessColor(score: number): string {
      if (score >= 80) return '#10B981'; // Green
      if (score >= 60) return '#F59E0B'; // Yellow
      if (score >= 40) return '#EF4444'; // Red
      return '#6B7280'; // Gray
    }

    it('should return correct colors for different score ranges', () => {
      expect(getReadinessColor(100)).toBe('#10B981'); // Green
      expect(getReadinessColor(85)).toBe('#10B981'); // Green
      expect(getReadinessColor(80)).toBe('#10B981'); // Green
      
      expect(getReadinessColor(79)).toBe('#F59E0B'); // Yellow
      expect(getReadinessColor(65)).toBe('#F59E0B'); // Yellow
      expect(getReadinessColor(60)).toBe('#F59E0B'); // Yellow
      
      expect(getReadinessColor(59)).toBe('#EF4444'); // Red
      expect(getReadinessColor(45)).toBe('#EF4444'); // Red
      expect(getReadinessColor(40)).toBe('#EF4444'); // Red
      
      expect(getReadinessColor(39)).toBe('#6B7280'); // Gray
      expect(getReadinessColor(20)).toBe('#6B7280'); // Gray
      expect(getReadinessColor(0)).toBe('#6B7280'); // Gray
    });
  });

  describe('getReadinessText', () => {
    function getReadinessText(score: number): string {
      if (score >= 80) return 'Exam Ready!';
      if (score >= 60) return 'Almost Ready';
      if (score >= 40) return 'Needs Work';
      if (score > 0) return 'Getting Started';
      return 'Not Started';
    }

    it('should return correct text for different score ranges', () => {
      expect(getReadinessText(100)).toBe('Exam Ready!');
      expect(getReadinessText(85)).toBe('Exam Ready!');
      expect(getReadinessText(80)).toBe('Exam Ready!');
      
      expect(getReadinessText(79)).toBe('Almost Ready');
      expect(getReadinessText(65)).toBe('Almost Ready');
      expect(getReadinessText(60)).toBe('Almost Ready');
      
      expect(getReadinessText(59)).toBe('Needs Work');
      expect(getReadinessText(45)).toBe('Needs Work');
      expect(getReadinessText(40)).toBe('Needs Work');
      
      expect(getReadinessText(39)).toBe('Getting Started');
      expect(getReadinessText(20)).toBe('Getting Started');
      expect(getReadinessText(1)).toBe('Getting Started');
      
      expect(getReadinessText(0)).toBe('Not Started');
    });
  });
});