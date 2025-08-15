import { getBetaVariantContent, shouldShowGiftCardIncentive, BETA_ONBOARDING_COPY } from '@/lib/constants/beta-onboarding';

describe('Beta A/B Testing', () => {
  describe('Variant Content', () => {
    it('should return variant A content by default', () => {
      const contentA = getBetaVariantContent();
      expect(contentA.ctaPrimary).toBe('Start Diagnostic');
      expect(contentA.incentiveText).toBe(null);
      expect(contentA.progressDescription).not.toContain('gift card');
    });

    it('should return variant A content when explicitly requested', () => {
      const contentA = getBetaVariantContent('A');
      expect(contentA.ctaPrimary).toBe('Start Diagnostic');
      expect(contentA.incentiveText).toBe(null);
      expect(contentA.skipBanner.cta).toBe('Start now');
    });

    it('should return variant B content with gift card incentive', () => {
      const contentB = getBetaVariantContent('B');
      expect(contentB.ctaPrimary).toBe('Start Diagnostic & Earn $20');
      expect(contentB.incentiveText).toContain('$20 gift card');
      expect(contentB.progressDescription).toContain('gift card');
      expect(contentB.skipBanner.cta).toBe('Start now & earn $20');
      expect(contentB.skipBanner.message).toContain('$20 gift card');
    });

    it('should handle null variant by defaulting to A', () => {
      const content = getBetaVariantContent(null);
      expect(content.ctaPrimary).toBe('Start Diagnostic');
      expect(content.incentiveText).toBe(null);
    });
  });

  describe('Gift Card Logic', () => {
    it('should not show gift card for variant A', () => {
      expect(shouldShowGiftCardIncentive('A')).toBe(false);
    });

    it('should show gift card for variant B', () => {
      expect(shouldShowGiftCardIncentive('B')).toBe(true);
    });

    it('should not show gift card for null variant (defaults to A)', () => {
      expect(shouldShowGiftCardIncentive(null)).toBe(false);
    });
  });

  describe('A/B Test Content Completeness', () => {
    it('should have all required content for both variants', () => {
      const variantA = BETA_ONBOARDING_COPY.variants.A;
      const variantB = BETA_ONBOARDING_COPY.variants.B;

      // Check variant A
      expect(variantA.ctaPrimary).toBeTruthy();
      expect(variantA.progressDescription).toBeTruthy();
      expect(variantA.skipBanner.message).toBeTruthy();
      expect(variantA.skipBanner.cta).toBeTruthy();

      // Check variant B
      expect(variantB.ctaPrimary).toBeTruthy();
      expect(variantB.incentiveText).toBeTruthy();
      expect(variantB.progressDescription).toBeTruthy();
      expect(variantB.skipBanner.message).toBeTruthy();
      expect(variantB.skipBanner.cta).toBeTruthy();
    });

    it('should have distinct content between variants', () => {
      const variantA = BETA_ONBOARDING_COPY.variants.A;
      const variantB = BETA_ONBOARDING_COPY.variants.B;

      expect(variantA.ctaPrimary).not.toBe(variantB.ctaPrimary);
      expect(variantA.progressDescription).not.toBe(variantB.progressDescription);
      expect(variantA.skipBanner.cta).not.toBe(variantB.skipBanner.cta);
      expect(variantA.skipBanner.message).not.toBe(variantB.skipBanner.message);
    });

    it('should have gift card mentions only in variant B', () => {
      const variantA = BETA_ONBOARDING_COPY.variants.A;
      const variantB = BETA_ONBOARDING_COPY.variants.B;

      // Variant A should not mention gift cards
      expect(variantA.ctaPrimary.toLowerCase()).not.toContain('gift');
      expect(variantA.ctaPrimary.toLowerCase()).not.toContain('$20');
      expect(variantA.progressDescription.toLowerCase()).not.toContain('gift');
      expect(variantA.incentiveText).toBe(null);

      // Variant B should mention gift cards/money
      expect(variantB.ctaPrimary.toLowerCase()).toContain('$20');
      expect(variantB.incentiveText!.toLowerCase()).toContain('gift card');
      expect(variantB.progressDescription.toLowerCase()).toContain('gift card');
      expect(variantB.skipBanner.message.toLowerCase()).toContain('gift card');
    });
  });

  describe('Analytics Properties', () => {
    it('should provide correct gift card incentive flag for analytics', () => {
      expect(shouldShowGiftCardIncentive('A')).toBe(false);
      expect(shouldShowGiftCardIncentive('B')).toBe(true);
    });
  });
});