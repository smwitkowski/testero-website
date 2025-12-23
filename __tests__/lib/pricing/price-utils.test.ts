import {
  getTierNameFromPriceId,
  getPaymentMode,
  getPlanType,
  isExamPackagePrice,
} from "@/lib/pricing/price-utils";

describe("price-utils", () => {
  // Store original env vars
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to clear any cached values
    jest.resetModules();

    // Set up test environment variables for all price IDs
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_STRIPE_BASIC_MONTHLY: "price_basic_monthly",
      NEXT_PUBLIC_STRIPE_BASIC_3MONTH: "price_basic_3month",
      NEXT_PUBLIC_STRIPE_PRO_MONTHLY: "price_pro_monthly",
      NEXT_PUBLIC_STRIPE_PRO_3MONTH: "price_pro_3month",
      NEXT_PUBLIC_STRIPE_ALL_ACCESS_MONTHLY: "price_all_access_monthly",
      NEXT_PUBLIC_STRIPE_ALL_ACCESS_3MONTH: "price_all_access_3month",
      NEXT_PUBLIC_STRIPE_EXAM_3MONTH: "price_exam_3month",
      NEXT_PUBLIC_STRIPE_EXAM_6MONTH: "price_exam_6month",
      NEXT_PUBLIC_STRIPE_EXAM_12MONTH: "price_exam_12month",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getTierNameFromPriceId", () => {
    it("should return 'PMLE Readiness' for Basic monthly price ID", () => {
      expect(getTierNameFromPriceId("price_basic_monthly")).toBe("PMLE Readiness");
    });

    it("should return 'PMLE Readiness' for Basic 3-month price ID", () => {
      expect(getTierNameFromPriceId("price_basic_3month")).toBe("PMLE Readiness");
    });

    it("should return 'Pro' for Pro monthly price ID", () => {
      expect(getTierNameFromPriceId("price_pro_monthly")).toBe("Pro");
    });

    it("should return 'Pro' for Pro 3-month price ID", () => {
      expect(getTierNameFromPriceId("price_pro_3month")).toBe("Pro");
    });

    it("should return 'All-Access' for All-Access monthly price ID", () => {
      expect(getTierNameFromPriceId("price_all_access_monthly")).toBe("All-Access");
    });

    it("should return 'All-Access' for All-Access 3-month price ID", () => {
      expect(getTierNameFromPriceId("price_all_access_3month")).toBe("All-Access");
    });

    it("should return '3-Month Package' for 3-month exam package price ID", () => {
      expect(getTierNameFromPriceId("price_exam_3month")).toBe("3-Month Package");
    });

    it("should return '6-Month Package' for 6-month exam package price ID", () => {
      expect(getTierNameFromPriceId("price_exam_6month")).toBe("6-Month Package");
    });

    it("should return '12-Month Package' for 12-month exam package price ID", () => {
      expect(getTierNameFromPriceId("price_exam_12month")).toBe("12-Month Package");
    });

    it("should return 'Unknown' for unrecognized price ID", () => {
      expect(getTierNameFromPriceId("price_unknown")).toBe("Unknown");
    });

    it("should return 'Unknown' for empty string", () => {
      expect(getTierNameFromPriceId("")).toBe("Unknown");
    });
  });

  describe("isExamPackagePrice", () => {
    it("should return true for 3-month exam package price ID", () => {
      expect(isExamPackagePrice("price_exam_3month")).toBe(true);
    });

    it("should return true for 6-month exam package price ID", () => {
      expect(isExamPackagePrice("price_exam_6month")).toBe(true);
    });

    it("should return true for 12-month exam package price ID", () => {
      expect(isExamPackagePrice("price_exam_12month")).toBe(true);
    });

    it("should return false for Basic monthly price ID", () => {
      expect(isExamPackagePrice("price_basic_monthly")).toBe(false);
    });

    it("should return false for Pro 3-month price ID", () => {
      expect(isExamPackagePrice("price_pro_3month")).toBe(false);
    });

    it("should return false for All-Access monthly price ID", () => {
      expect(isExamPackagePrice("price_all_access_monthly")).toBe(false);
    });

    it("should return false for unknown price ID", () => {
      expect(isExamPackagePrice("price_unknown")).toBe(false);
    });
  });

  describe("getPaymentMode", () => {
    it("should return 'payment' for exam package price IDs", () => {
      expect(getPaymentMode("price_exam_3month")).toBe("payment");
      expect(getPaymentMode("price_exam_6month")).toBe("payment");
      expect(getPaymentMode("price_exam_12month")).toBe("payment");
    });

    it("should return 'subscription' for subscription tier price IDs", () => {
      expect(getPaymentMode("price_basic_monthly")).toBe("subscription");
      expect(getPaymentMode("price_basic_3month")).toBe("subscription");
      expect(getPaymentMode("price_pro_monthly")).toBe("subscription");
      expect(getPaymentMode("price_pro_3month")).toBe("subscription");
      expect(getPaymentMode("price_all_access_monthly")).toBe("subscription");
      expect(getPaymentMode("price_all_access_3month")).toBe("subscription");
    });

    it("should return 'subscription' for unknown price ID", () => {
      expect(getPaymentMode("price_unknown")).toBe("subscription");
    });
  });

  describe("getPlanType", () => {
    it("should return 'exam_package' for exam package price IDs", () => {
      expect(getPlanType("price_exam_3month")).toBe("exam_package");
      expect(getPlanType("price_exam_6month")).toBe("exam_package");
      expect(getPlanType("price_exam_12month")).toBe("exam_package");
    });

    it("should return 'subscription' for subscription tier price IDs", () => {
      expect(getPlanType("price_basic_monthly")).toBe("subscription");
      expect(getPlanType("price_basic_3month")).toBe("subscription");
      expect(getPlanType("price_pro_monthly")).toBe("subscription");
      expect(getPlanType("price_pro_3month")).toBe("subscription");
      expect(getPlanType("price_all_access_monthly")).toBe("subscription");
      expect(getPlanType("price_all_access_3month")).toBe("subscription");
    });

    it("should return 'subscription' for unknown price ID", () => {
      expect(getPlanType("price_unknown")).toBe("subscription");
    });
  });
});

