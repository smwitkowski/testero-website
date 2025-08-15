import { BETA_ONBOARDING_COPY, FEATURE_FLAGS } from '@/lib/constants/beta-onboarding';
import { ANALYTICS_EVENTS } from '@/lib/analytics/analytics';

describe('Beta Onboarding Flow', () => {
  describe('Constants', () => {
    it('should have all required copy strings', () => {
      expect(BETA_ONBOARDING_COPY.welcome.headline).toBe("You're in — let's kick off your beta journey.");
      expect(BETA_ONBOARDING_COPY.welcome.body).toContain('~20-minute diagnostic');
      expect(BETA_ONBOARDING_COPY.welcome.ctaPrimary).toBe('Start Diagnostic');
      expect(BETA_ONBOARDING_COPY.welcome.ctaSecondary).toBe('Skip for now');
      expect(BETA_ONBOARDING_COPY.variants.A.skipBanner.message).toContain('diagnostic');
      expect(BETA_ONBOARDING_COPY.progressSteps).toHaveLength(3);
    });

    it('should have feature flag configuration', () => {
      expect(typeof FEATURE_FLAGS.BETA_ONBOARDING_FLOW).toBe('boolean');
    });
  });

  describe('Analytics Events', () => {
    it('should have all required beta onboarding events', () => {
      expect(ANALYTICS_EVENTS.BETA_STARTED).toBe('beta_started');
      expect(ANALYTICS_EVENTS.START_DIAGNOSTIC_CLICKED).toBe('start_diagnostic_clicked');
      expect(ANALYTICS_EVENTS.DIAGNOSTIC_SESSION_CREATED).toBe('diagnostic_session_created');
      expect(ANALYTICS_EVENTS.SKIP_DIAGNOSTIC_CLICKED).toBe('skip_diagnostic_clicked');
    });
  });

  describe('Error Messages', () => {
    it('should have user-friendly error messages', () => {
      expect(BETA_ONBOARDING_COPY.errors.noBetaAccess).toBe("Beta access isn't enabled for this account.");
      expect(BETA_ONBOARDING_COPY.errors.sessionCreateFailed).toBe("We couldn't start your diagnostic. Please try again.");
    });
  });

  describe('A/B Test Variants', () => {
    it('should have both A and B variants defined', () => {
      expect(BETA_ONBOARDING_COPY.variants.A).toBeDefined();
      expect(BETA_ONBOARDING_COPY.variants.B).toBeDefined();
      expect(BETA_ONBOARDING_COPY.variants.A.ctaPrimary).toBe('Start Diagnostic');
      expect(BETA_ONBOARDING_COPY.variants.B.ctaPrimary).toBe('Start Diagnostic & Earn $20');
    });
  });
});