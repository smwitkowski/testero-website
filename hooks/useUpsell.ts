import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { usePostHog } from 'posthog-js/react';

export type UpsellTrigger = 'paywall' | 'engagement' | 'exit-intent' | 'performance';
export type UpsellVariant = 'foundation' | 'almost' | 'polish';

interface UpsellState {
  isOpen: boolean;
  trigger: UpsellTrigger | null;
  variant: UpsellVariant;
  dwellStartTime: number;
  hasShownThisSession: boolean;
}

interface UpsellOptions {
  score: number;
  enableExitIntent?: boolean;
  enableDeepScroll?: boolean;
  weakDomains?: string[];
}

export const useUpsell = (options: UpsellOptions) => {
  const { user } = useAuth();
  const posthog = usePostHog();
  
  const [state, setState] = useState<UpsellState>({
    isOpen: false,
    trigger: null,
    variant: getVariantFromScore(options.score),
    dwellStartTime: Date.now(),
    hasShownThisSession: false,
  });

  // A/B test holdout (10-20% no modal)
  const abBucket = posthog?.getFeatureFlag('upsell_modal_test') || 'control';
  const isInHoldout = abBucket === 'holdout';

  // Check if user is in snooze period
  const isInSnooze = useCallback(() => {
    const storageKey = user?.id ? `upsell_snooze_${user.id}` : 'upsell_snooze_anon';
    const snoozeUntil = localStorage.getItem(storageKey);
    
    if (!snoozeUntil) return false;
    
    const snoozeTime = parseInt(snoozeUntil, 10);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() < (snoozeTime + sevenDaysMs);
  }, [user?.id]);

  // Get dwell time in milliseconds
  const getDwellTime = useCallback(() => {
    return Date.now() - state.dwellStartTime;
  }, [state.dwellStartTime]);

  // Check if we can show modal (guardrails)
  const canShowModal = useCallback(() => {
    // Never show within first 20 seconds
    if (getDwellTime() < 20000) return false;
    
    // Never show more than once per session
    if (state.hasShownThisSession) return false;
    
    // Respect 7-day snooze
    if (isInSnooze()) return false;
    
    // Don't show for high scores (unless feature flagged)
    if (options.score >= 80 && !posthog?.isFeatureEnabled('upsell_high_score')) {
      return false;
    }
    
    // A/B test holdout
    if (isInHoldout) return false;
    
    return true;
  }, [getDwellTime, state.hasShownThisSession, isInSnooze, options.score, posthog, isInHoldout]);

  // Get weak domains for analytics
  const getWeakDomains = useCallback(() => {
    return options.weakDomains || [];
  }, [options.weakDomains]);

  // Maybe open modal with specific trigger
  const maybeOpen = useCallback((trigger: UpsellTrigger) => {
    if (!canShowModal()) return false;
    
    setState(prev => {
      const newState = {
        ...prev,
        isOpen: true,
        trigger,
        hasShownThisSession: true,
      };

      // Fire analytics with current variant (after potential score-based updates)
      const currentVariant = getVariantFromScore(options.score);
      posthog?.capture('upsell_view', {
        trigger,
        score: options.score,
        dwellMs: getDwellTime(),
        weakDomains: getWeakDomains(),
        variant: currentVariant,
        abBucket,
      });

      return newState;
    });

    return true;
  }, [canShowModal, posthog, options.score, getDwellTime, getWeakDomains, abBucket]);

  // Force open modal (for testing)
  const openNow = useCallback((variant?: UpsellVariant) => {
    const finalVariant = variant || getVariantFromScore(options.score);
    
    setState(prev => ({
      ...prev,
      isOpen: true,
      trigger: 'paywall', // Default trigger for forced opens
      variant: finalVariant,
      hasShownThisSession: true,
    }));

    posthog?.capture('upsell_view', {
      trigger: 'forced',
      score: options.score,
      dwellMs: getDwellTime(),
      weakDomains: getWeakDomains(),
      variant: finalVariant,
      abBucket,
    });
  }, [posthog, options.score, getDwellTime, getWeakDomains, abBucket]);

  // Dismiss modal and set snooze
  const dismiss = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false, trigger: null }));
    
    // Set snooze period
    const storageKey = user?.id ? `upsell_snooze_${user.id}` : 'upsell_snooze_anon';
    localStorage.setItem(storageKey, Date.now().toString());
    
    // Fire analytics
    posthog?.capture('upsell_dismiss', {
      trigger: state.trigger,
      score: options.score,
      dwellMs: getDwellTime(),
      variant: state.variant,
      abBucket,
    });
  }, [user?.id, posthog, state.trigger, state.variant, options.score, getDwellTime, abBucket]);

  // Handle CTA click
  const handleCTAClick = useCallback(() => {
    posthog?.capture('upsell_cta_click', {
      trigger: state.trigger,
      score: options.score,
      dwellMs: getDwellTime(),
      variant: state.variant,
      abBucket,
    });
    
    // Close modal and navigate to signup/billing
    setState(prev => ({ ...prev, isOpen: false, trigger: null }));
  }, [posthog, state.trigger, state.variant, options.score, getDwellTime, abBucket]);

  return {
    isOpen: state.isOpen,
    trigger: state.trigger,
    variant: state.variant,
    canShowModal: canShowModal(),
    maybeOpen,
    openNow,
    dismiss,
    handleCTAClick,
    dwellTime: getDwellTime(),
  };
};

// Helper function to get variant based on score
function getVariantFromScore(score: number): UpsellVariant {
  if (score < 50) return 'foundation';
  if (score < 80) return 'almost';
  return 'polish';
}