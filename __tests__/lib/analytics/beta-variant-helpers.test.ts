import {
  getBetaVariantForAnalytics,
  createBetaVariantAnalyticsProps,
  isUserInBetaVariant,
  getBetaVariantWithFallback,
} from "@/lib/analytics/beta-variant-helpers";

describe("Beta Variant Analytics Helpers", () => {
  const mockUserA = {
    id: "user-123",
    user_metadata: {
      beta_variant: "A" as const,
      is_early_access: true,
    },
  };

  const mockUserB = {
    id: "user-456",
    user_metadata: {
      beta_variant: "B" as const,
      is_early_access: true,
    },
  };

  const mockUserNoVariant = {
    id: "user-789",
    user_metadata: {
      is_early_access: true,
    },
  };

  const mockUserInvalidVariant = {
    id: "user-invalid",
    user_metadata: {
      beta_variant: "C" as any,
    },
  };

  describe("getBetaVariantForAnalytics", () => {
    it("should return variant A for user with variant A", () => {
      expect(getBetaVariantForAnalytics(mockUserA)).toBe("A");
    });

    it("should return variant B for user with variant B", () => {
      expect(getBetaVariantForAnalytics(mockUserB)).toBe("B");
    });

    it("should return null for user without variant", () => {
      expect(getBetaVariantForAnalytics(mockUserNoVariant)).toBe(null);
    });

    it("should return null for null user", () => {
      expect(getBetaVariantForAnalytics(null)).toBe(null);
    });

    it("should return null and warn for invalid variant", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      expect(getBetaVariantForAnalytics(mockUserInvalidVariant)).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith("Unexpected beta variant value: C");

      consoleSpy.mockRestore();
    });

    it("should handle user without user_metadata", () => {
      const userNoMetadata = { id: "user-no-meta" };
      expect(getBetaVariantForAnalytics(userNoMetadata as any)).toBe(null);
    });
  });

  describe("createBetaVariantAnalyticsProps", () => {
    it("should create props with beta_variant for variant A user", () => {
      const props = createBetaVariantAnalyticsProps(mockUserA);
      expect(props).toEqual({
        beta_variant: "A",
      });
    });

    it("should create props with beta_variant for variant B user", () => {
      const props = createBetaVariantAnalyticsProps(mockUserB);
      expect(props).toEqual({
        beta_variant: "B",
      });
    });

    it("should create props with null beta_variant for user without variant", () => {
      const props = createBetaVariantAnalyticsProps(mockUserNoVariant);
      expect(props).toEqual({
        beta_variant: null,
      });
    });

    it("should merge additional properties", () => {
      const additionalProps = {
        user_id: "test-user",
        source: "test_page",
        action: "click",
      };

      const props = createBetaVariantAnalyticsProps(mockUserA, additionalProps);
      expect(props).toEqual({
        beta_variant: "A",
        user_id: "test-user",
        source: "test_page",
        action: "click",
      });
    });

    it("should handle empty additional properties", () => {
      const props = createBetaVariantAnalyticsProps(mockUserA, {});
      expect(props).toEqual({
        beta_variant: "A",
      });
    });

    it("should handle null user with additional properties", () => {
      const additionalProps = { action: "click" };
      const props = createBetaVariantAnalyticsProps(null, additionalProps);
      expect(props).toEqual({
        beta_variant: null,
        action: "click",
      });
    });
  });

  describe("isUserInBetaVariant", () => {
    it("should return true for user with variant A", () => {
      expect(isUserInBetaVariant(mockUserA)).toBe(true);
    });

    it("should return true for user with variant B", () => {
      expect(isUserInBetaVariant(mockUserB)).toBe(true);
    });

    it("should return false for user without variant", () => {
      expect(isUserInBetaVariant(mockUserNoVariant)).toBe(false);
    });

    it("should return false for null user", () => {
      expect(isUserInBetaVariant(null)).toBe(false);
    });

    it("should return false for user with invalid variant", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      expect(isUserInBetaVariant(mockUserInvalidVariant)).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("getBetaVariantWithFallback", () => {
    it("should return variant A for user with variant A", () => {
      expect(getBetaVariantWithFallback(mockUserA)).toBe("A");
    });

    it("should return variant B for user with variant B", () => {
      expect(getBetaVariantWithFallback(mockUserB)).toBe("B");
    });

    it("should return default fallback for user without variant", () => {
      expect(getBetaVariantWithFallback(mockUserNoVariant)).toBe("unknown");
    });

    it("should return custom fallback for user without variant", () => {
      expect(getBetaVariantWithFallback(mockUserNoVariant, "control")).toBe("control");
    });

    it("should return fallback for null user", () => {
      expect(getBetaVariantWithFallback(null)).toBe("unknown");
      expect(getBetaVariantWithFallback(null, "default")).toBe("default");
    });

    it("should return fallback for invalid variant", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      expect(getBetaVariantWithFallback(mockUserInvalidVariant, "fallback")).toBe("fallback");

      consoleSpy.mockRestore();
    });
  });
});
