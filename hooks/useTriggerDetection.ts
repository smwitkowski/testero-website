import { useEffect, useRef, useCallback } from 'react';
import { UpsellTrigger } from './useUpsell';

interface TriggerDetectionOptions {
  onTrigger: (trigger: UpsellTrigger) => void;
  score: number;
  criticalDomainCount: number;
  enableExitIntent?: boolean;
  enableDeepScroll?: boolean;
}

export const useTriggerDetection = (options: TriggerDetectionOptions) => {
  const {
    onTrigger,
    score,
    criticalDomainCount,
    enableExitIntent = false,
    enableDeepScroll = false,
  } = options;

  // Refs for tracking state
  const dwellStartRef = useRef(Date.now());
  const reviewSectionTimeRef = useRef<number | null>(null);
  const expandedCountRef = useRef(0);
  const hasTriggeredExitIntentRef = useRef(false);
  const hasTriggeredDeepScrollRef = useRef(false);
  const hasTriggeredPerformanceRef = useRef(false);
  const networkRequestsRef = useRef<Set<string>>(new Set());

  // Reset tracking when component mounts
  useEffect(() => {
    dwellStartRef.current = Date.now();
    expandedCountRef.current = 0;
    hasTriggeredExitIntentRef.current = false;
    hasTriggeredDeepScrollRef.current = false;
    hasTriggeredPerformanceRef.current = false;
    networkRequestsRef.current.clear();
  }, []);

  // Paywall trigger helper
  const checkPaywallTrigger = useCallback((actionType: 'study_plan' | 'practice') => {
    // Check if there's a free limit reached
    // This would typically check against user's usage limits
    const hasReachedFreeLimit = false; // TODO: Implement actual limit checking from user context/subscription
    
    if (hasReachedFreeLimit) {
      // Check if there's a request in flight to prevent duplicate triggers
      if (networkRequestsRef.current.has(actionType)) {
        return false; // Debounce - request already in flight
      }
      
      networkRequestsRef.current.add(actionType);
      setTimeout(() => {
        networkRequestsRef.current.delete(actionType);
      }, 3000); // Clear after 3 seconds
      
      onTrigger('paywall');
      return true;
    }
    return false;
  }, [onTrigger]);

  // Track time in review section
  const trackReviewSectionEntry = useCallback(() => {
    if (!reviewSectionTimeRef.current) {
      reviewSectionTimeRef.current = Date.now();
    }
  }, []);

  const trackReviewSectionExit = useCallback(() => {
    if (reviewSectionTimeRef.current) {
      const timeInSection = Date.now() - reviewSectionTimeRef.current;
      if (timeInSection >= 90000) { // 90 seconds
        onTrigger('engagement');
      }
      reviewSectionTimeRef.current = null;
    }
  }, [onTrigger]);

  // Track explanation expansions
  const trackExplanationExpansion = useCallback(() => {
    expandedCountRef.current += 1;
    if (expandedCountRef.current >= 3) {
      onTrigger('engagement');
    }
  }, [onTrigger]);

  // Exit intent detection (desktop)
  useEffect(() => {
    if (!enableExitIntent || hasTriggeredExitIntentRef.current) return;

    const handleMouseLeave = (event: MouseEvent) => {
      const dwellTime = Date.now() - dwellStartRef.current;
      
      // Only trigger after 45s dwell time
      if (dwellTime < 45000) return;
      
      // Check if cursor is leaving from the top with significant upward movement
      // This prevents false positives from small cursor movements
      if (event.clientY <= 0 && event.movementY < -50 && !hasTriggeredExitIntentRef.current) {
        hasTriggeredExitIntentRef.current = true;
        onTrigger('exit-intent');
      }
    };

    // Only add on desktop (not mobile)
    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      document.addEventListener('mouseleave', handleMouseLeave);
      return () => document.removeEventListener('mouseleave', handleMouseLeave);
    }
  }, [enableExitIntent, onTrigger]);

  // Deep scroll detection (mobile)
  useEffect(() => {
    if (!enableDeepScroll || hasTriggeredDeepScrollRef.current) return;

    const handleScroll = () => {
      const scrolled = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollPercentage = (scrolled + windowHeight) / documentHeight;

      // Trigger at 75% scroll depth on mobile
      const isMobile = window.innerWidth < 768;
      if (isMobile && scrollPercentage >= 0.75 && !hasTriggeredDeepScrollRef.current) {
        hasTriggeredDeepScrollRef.current = true;
        onTrigger('exit-intent'); // Use same trigger as exit-intent
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [enableDeepScroll, onTrigger]);

  // Performance trigger - when study plan comes into view
  const checkPerformanceTrigger = useCallback(() => {
    if (hasTriggeredPerformanceRef.current) return;
    
    // Check conditions: score < 50% AND >= 2 critical domains
    if (score < 50 && criticalDomainCount >= 2) {
      hasTriggeredPerformanceRef.current = true;
      onTrigger('performance');
    }
  }, [score, criticalDomainCount, onTrigger]);

  // Intersection observer for study plan visibility
  const studyPlanRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setStudyPlanRef = useCallback((element: HTMLElement | null) => {
    studyPlanRef.current = element;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    if (element) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              checkPerformanceTrigger();
            }
          });
        },
        { threshold: 0.5 } // Trigger when 50% visible
      );
      
      observerRef.current.observe(element);
    }
  }, [checkPerformanceTrigger]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    checkPaywallTrigger,
    trackReviewSectionEntry,
    trackReviewSectionExit,
    trackExplanationExpansion,
    setStudyPlanRef,
  };
};