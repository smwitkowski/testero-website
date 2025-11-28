"use client";

import { useState, useEffect, useCallback } from "react";

export interface TestStats {
  answeredCount: number;
  unansweredCount: number;
  flaggedCount: number;
  progressPercent: number;
}

/**
 * Derives test statistics from answers, total questions, and current index
 */
export function deriveTestStats(
  answers: Record<string, string | null>,
  totalQuestions: number,
  flaggedCount: number,
  currentIndex: number = 0
): TestStats {
  const answeredCount = Object.values(answers).filter((answer) => answer !== null).length;
  const unansweredCount = totalQuestions - answeredCount;
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  return {
    answeredCount,
    unansweredCount,
    flaggedCount,
    progressPercent,
  };
}

/**
 * Storage key prefix for practice test flags
 */
function getStorageKey(sessionId: string): string {
  return `testero_practice_flags_${sessionId}`;
}

/**
 * Load flags from localStorage for a given session
 */
export function loadFlagsFromStorage(sessionId: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const key = getStorageKey(sessionId);
    const stored = localStorage.getItem(key);
    if (!stored) {
      return new Set();
    }
    const parsed = JSON.parse(stored) as string[];
    return new Set(parsed);
  } catch (error) {
    console.error("Failed to load flags from storage:", error);
    return new Set();
  }
}

/**
 * Save flags to localStorage for a given session
 */
export function saveFlagsToStorage(sessionId: string, flags: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getStorageKey(sessionId);
    const array = Array.from(flags);
    localStorage.setItem(key, JSON.stringify(array));
  } catch (error) {
    console.error("Failed to save flags to storage:", error);
  }
}

/**
 * Clear flags from localStorage for a given session
 */
export function clearFlagsFromStorage(sessionId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = getStorageKey(sessionId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to clear flags from storage:", error);
  }
}

export interface UsePracticeTestStateOptions {
  sessionId: string;
  totalQuestions: number;
  questionIds: string[];
}

export interface UsePracticeTestStateReturn {
  answers: Record<string, string | null>;
  flagged: Set<string>;
  currentIndex: number;
  stats: TestStats;
  setAnswer: (questionId: string, selectedLabel: string | null) => void;
  toggleFlag: (questionId: string) => void;
  setCurrentIndex: (index: number) => void;
  clearFlags: () => void;
}

/**
 * Hook for managing practice test state (exam mode)
 * Handles answers, flags, and navigation state
 */
export function usePracticeTestState({
  sessionId,
  totalQuestions,
  questionIds,
}: UsePracticeTestStateOptions): UsePracticeTestStateReturn {
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [flagged, setFlagged] = useState<Set<string>>(() => loadFlagsFromStorage(sessionId));
  const [currentIndex, setCurrentIndex] = useState(0);

  // Load flags from storage on mount
  useEffect(() => {
    const storedFlags = loadFlagsFromStorage(sessionId);
    setFlagged(storedFlags);
  }, [sessionId]);

  // Save flags to storage whenever they change
  useEffect(() => {
    saveFlagsToStorage(sessionId, flagged);
  }, [sessionId, flagged]);

  const setAnswer = useCallback((questionId: string, selectedLabel: string | null) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: selectedLabel,
    }));
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  const clearFlags = useCallback(() => {
    clearFlagsFromStorage(sessionId);
    setFlagged(new Set());
  }, [sessionId]);

  const stats = deriveTestStats(answers, totalQuestions, flagged.size, currentIndex);

  return {
    answers,
    flagged,
    currentIndex,
    stats,
    setAnswer,
    toggleFlag,
    setCurrentIndex,
    clearFlags,
  };
}

