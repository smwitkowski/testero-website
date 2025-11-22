import {
  getExamReadinessTier,
  getDomainTier,
  READINESS_PASS_THRESHOLD,
  type ExamReadinessTier,
  type DomainTier,
} from "@/lib/readiness";

describe("readiness helpers", () => {
  describe("getExamReadinessTier", () => {
    it("should return 'low' tier for scores below 40", () => {
      const tier = getExamReadinessTier(0);
      expect(tier.id).toBe("low");
      expect(tier.label).toBe("Low");
      expect(tier.description).toBeTruthy();

      const tier39 = getExamReadinessTier(39);
      expect(tier39.id).toBe("low");
      expect(tier39.label).toBe("Low");
    });

    it("should return 'building' tier for scores 40-69", () => {
      const tier40 = getExamReadinessTier(40);
      expect(tier40.id).toBe("building");
      expect(tier40.label).toBe("Building");
      expect(tier40.description).toBeTruthy();

      const tier69 = getExamReadinessTier(69);
      expect(tier69.id).toBe("building");
      expect(tier69.label).toBe("Building");

      const tier55 = getExamReadinessTier(55);
      expect(tier55.id).toBe("building");
    });

    it("should return 'ready' tier for scores 70-84", () => {
      const tier70 = getExamReadinessTier(70);
      expect(tier70.id).toBe("ready");
      expect(tier70.label).toBe("Ready");
      expect(tier70.description).toBeTruthy();

      const tier84 = getExamReadinessTier(84);
      expect(tier84.id).toBe("ready");
      expect(tier84.label).toBe("Ready");

      const tier77 = getExamReadinessTier(77);
      expect(tier77.id).toBe("ready");
    });

    it("should return 'strong' tier for scores 85 and above", () => {
      const tier85 = getExamReadinessTier(85);
      expect(tier85.id).toBe("strong");
      expect(tier85.label).toBe("Strong");
      expect(tier85.description).toBeTruthy();

      const tier100 = getExamReadinessTier(100);
      expect(tier100.id).toBe("strong");
      expect(tier100.label).toBe("Strong");

      const tier95 = getExamReadinessTier(95);
      expect(tier95.id).toBe("strong");
    });

    it("should handle boundary cases correctly", () => {
      expect(getExamReadinessTier(39.9).id).toBe("low");
      expect(getExamReadinessTier(40).id).toBe("building");
      expect(getExamReadinessTier(69.9).id).toBe("building");
      expect(getExamReadinessTier(70).id).toBe("ready");
      expect(getExamReadinessTier(84.9).id).toBe("ready");
      expect(getExamReadinessTier(85).id).toBe("strong");
    });

    it("should return valid tier structure with all required fields", () => {
      const tier = getExamReadinessTier(75);
      expect(tier).toHaveProperty("id");
      expect(tier).toHaveProperty("label");
      expect(tier).toHaveProperty("description");
      expect(typeof tier.id).toBe("string");
      expect(typeof tier.label).toBe("string");
      expect(typeof tier.description).toBe("string");
      expect(["low", "building", "ready", "strong"]).toContain(tier.id);
    });
  });

  describe("getDomainTier", () => {
    it("should return 'critical' tier for scores below 40", () => {
      const tier = getDomainTier(0);
      expect(tier.id).toBe("critical");
      expect(tier.label).toBe("Critical");

      const tier39 = getDomainTier(39);
      expect(tier39.id).toBe("critical");
      expect(tier39.label).toBe("Critical");
    });

    it("should return 'moderate' tier for scores 40-69", () => {
      const tier40 = getDomainTier(40);
      expect(tier40.id).toBe("moderate");
      expect(tier40.label).toBe("Moderate");

      const tier69 = getDomainTier(69);
      expect(tier69.id).toBe("moderate");
      expect(tier69.label).toBe("Moderate");

      const tier55 = getDomainTier(55);
      expect(tier55.id).toBe("moderate");
    });

    it("should return 'strong' tier for scores 70 and above", () => {
      const tier70 = getDomainTier(70);
      expect(tier70.id).toBe("strong");
      expect(tier70.label).toBe("Strong");

      const tier100 = getDomainTier(100);
      expect(tier100.id).toBe("strong");
      expect(tier100.label).toBe("Strong");

      const tier85 = getDomainTier(85);
      expect(tier85.id).toBe("strong");
    });

    it("should handle boundary cases correctly", () => {
      expect(getDomainTier(39.9).id).toBe("critical");
      expect(getDomainTier(40).id).toBe("moderate");
      expect(getDomainTier(69.9).id).toBe("moderate");
      expect(getDomainTier(70).id).toBe("strong");
    });

    it("should return valid tier structure with all required fields", () => {
      const tier = getDomainTier(75);
      expect(tier).toHaveProperty("id");
      expect(tier).toHaveProperty("label");
      expect(typeof tier.id).toBe("string");
      expect(typeof tier.label).toBe("string");
      expect(["critical", "moderate", "strong"]).toContain(tier.id);
    });
  });

  describe("READINESS_PASS_THRESHOLD", () => {
    it("should be set to 70", () => {
      expect(READINESS_PASS_THRESHOLD).toBe(70);
    });

    it("should align with Ready tier threshold", () => {
      // Pass threshold should match the lower bound of the "Ready" tier
      const tierAtThreshold = getExamReadinessTier(READINESS_PASS_THRESHOLD);
      expect(tierAtThreshold.id).toBe("ready");
    });
  });
});

